import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import worker, {RoomObject} from '../worker/index.js';
import {RoomClient} from '../js/room-client.js';
import {RoomAdapter} from '../js/room-adapter.js';
import {trainingSkills} from '../js/development.js';

const browserStorage=()=>{
 const values=new Map();
 return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
};
function durableStorage(){
 const values=new Map();
 const storage={
  async get(key){return Array.isArray(key)?new Map(key.filter(k=>values.has(k)).map(k=>[k,structuredClone(values.get(k))])):structuredClone(values.get(key));},
  async put(key,value){assert.ok(Buffer.byteLength(JSON.stringify(value))<128*1024);values.set(key,structuredClone(value));},
  async delete(key){values.delete(key);},async setAlarm(){},async deleteAlarm(){},
  async transaction(callback){const before=new Map(values);try{return await callback(storage);}catch(error){values.clear();for(const entry of before)values.set(...entry);throw error;}}
 };
 return storage;
}

test('real HTTP room flow: two humans, barriers, retries, restore, auction, season and offseason',async t=>{
 const rooms=new Map(),NativeRequest=globalThis.Request;
 // Node requires duplex when forwarding a stream; Cloudflare accepts it directly.
 globalThis.Request=class extends NativeRequest{constructor(input,options){super(input,{...options,duplex:'half'});}};
 t.after(()=>{globalThis.Request=NativeRequest;});
 const env={ROOMS:{idFromName:id=>id,get(id){
  if(!rooms.has(id)){const state={storage:durableStorage()};rooms.set(id,{state,object:new RoomObject(state,{})});}
  return {fetch:request=>rooms.get(id).object.fetch(request)};
 }}};
 const server=createServer(async(req,res)=>{
  try{
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const response=await worker.fetch(new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),env);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  }catch(error){res.writeHead(500);res.end(JSON.stringify({error:error.message}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`,realFetch=globalThis.fetch,realNow=Date.now;
 const oldLocal=globalThis.localStorage,oldSession=globalThis.sessionStorage;
 let clock=realNow();Date.now=()=>clock;
 globalThis.localStorage=browserStorage();globalThis.sessionStorage=browserStorage();
 globalThis.fetch=(path,options)=>realFetch(new URL(path,base),options);
 t.after(async()=>{globalThis.fetch=realFetch;Date.now=realNow;globalThis.localStorage=oldLocal;globalThis.sessionStorage=oldSession;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const clients=[];t.after(()=>clients.forEach(c=>c.stop()));
 const request=async(path,body,token,status=200)=>{
  const response=await realFetch(base+'/api/rooms'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{'x-player-token':token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;
 };
 const client=new RoomClient(()=>{},()=>{});clients.push(client);
 let room=await client.enter('create','WHITE');client.stop();const first={...client.session};
 assert.equal(room.players[0].color,'#ffffff');
 let joiningState={};const joining=new RoomAdapter(()=>joiningState,next=>joiningState=next,()=>{},()=>{});clients.push(joining.client);
 room=await joining.enter('join','BLUE',room.roomId);joining.client.stop();
 const second={...joining.client.session};
 assert.equal(joiningState.view,'roomLobby');
 await request(`/${room.roomId}?playerId=${first.playerId}`,null,'wrong-token',403);
 const mutate=async(session,action,input={},status=200,body=null)=>{
  const payload=body||{playerId:session.playerId,phaseRevision:room.phaseRevision,requestId:crypto.randomUUID(),input};
  const result=await request(`/${session.roomId}/${action}`,payload,session.playerToken,status);
  if(result.room)room=result.room;return {result,payload};
 };
 await mutate(second,'start',{},403);await mutate(first,'start');assert.equal(room.phase,'draft');
 assert.doesNotMatch(JSON.stringify(room),/"(?:accessToken|hiddenGrowth|rngState|seed)":/);
 assert.ok(room.game.league.clubs.flatMap(club=>club.roster).every(player=>player.growthExpectationKey), 'Online rosters include a displayable growth expectation');
 assert.ok(room.game.draft.pool.filter(player=>!player.rareCharacter).every(player=>player.growthExpectationKey), 'Draft candidates include their growth expectation');
 const pick=room.game.draft.pool[0].id;
 await mutate(first,'submit',{playerId:pick});assert.equal(room.phase,'draft');
 assert.deepEqual(room.players.map(p=>p.completed),[true,false]);
 await mutate(second,'submit',{playerId:pick});
 assert.ok(room.game.draft.history.some(row=>row.player.id===pick&&row.contested));
 for(let guard=0;room.phase==='draft'&&guard<30;guard++){
  const pending=room.players.find(p=>room.game.draft.pendingClubIds.includes(p.clubId)&&!p.completed);
  assert.ok(pending);await mutate(pending.id===first.playerId?first:second,'submit',{pass:true});
 }
 assert.equal(room.phase,'draft-complete');
 await mutate(first,'submit');assert.equal(room.phase,'draft-complete');
 await mutate(second,'submit');assert.equal(room.phase,'auction');
 const lot=room.game.auction.pool[room.game.auction.i];
 await mutate(first,'submit',{playerId:'stale',pass:true},400);
 await mutate(first,'submit',{playerId:lot.id,pass:true});
 for(let guard=0;room.phase==='auction'&&guard<100;guard++){
  clock+=60000;room=(await request(`/${room.roomId}?playerId=${first.playerId}`,null,first.playerToken)).room;
 }
 assert.equal(room.phase,'auction-complete');assert.equal(room.game.auction.history.length,room.game.auction.pool.length);
 await mutate(first,'submit');assert.equal(room.phase,'auction-complete');await mutate(second,'submit');
 assert.equal(room.phase,'team-setup');
 const clubFor=session=>room.game.league.clubs.find(c=>c.id===room.players.find(p=>p.id===session.playerId).clubId);
 const setup=clubFor(first),lineup=[...setup.lineup];[lineup[2],lineup[3]]=[lineup[3],lineup[2]];
 localStorage.setItem('football-league:v3:session',JSON.stringify(first));
 let state={};const adapter=new RoomAdapter(()=>state,next=>state=next,()=>{},()=>{});adapter.active=true;adapter.client.room=room;adapter.receive(room);
 state.league.clubs.find(c=>c.id===setup.id).lineup=lineup;adapter.remember();
 let restored={};const reopened=new RoomAdapter(()=>restored,next=>restored=next,()=>{},()=>{});reopened.active=true;reopened.client.room=room;reopened.receive(room);
 assert.deepEqual(restored.league.clubs.find(c=>c.id===setup.id).lineup,lineup);
 await mutate(first,'submit',{lineup,tactic:setup.tactic});assert.equal(room.phase,'team-setup');
 const setup2=clubFor(second);await mutate(second,'submit',{lineup:setup2.lineup,tactic:setup2.tactic});assert.equal(room.phase,'season-ready');
 await mutate(first,'run-season',{},400);
 await mutate(first,'submit');assert.equal(room.phase,'season-ready');
 // Lose a successful response, retry exactly the same request and prove no second season runs.
 client.session=second;client.room=room;client.pending=null;
 const id=crypto.randomUUID(),pending={kind:'mutation',roomId:room.roomId,path:`/${room.roomId}/submit`,body:{playerId:second.playerId,phaseRevision:room.phaseRevision,requestId:id,input:{}}};
 let lost=true;
 globalThis.fetch=async(path,options)=>{const result=await realFetch(new URL(path,base),options);if(lost&&options.method==='POST'){lost=false;throw new TypeError('lost response');}return result;};
 await assert.rejects(client.send(pending),/lost response/);assert.equal(client.pending.body.requestId,id);
 const retry=new RoomClient(()=>{},()=>{});clients.push(retry);retry.session=second;
 await retry.resume();retry.stop();room=retry.room;
 assert.equal(room.phase,'season-result');assert.equal(retry.pending,null);
 assert.equal(room.game.league.fixtureResults.length,30);
 for(const session of [first,second]){
  const own=clubFor(session);assert.equal(room.game.league.seasonResults.filter(m=>m.fixture.homeId===own.id||m.fixture.awayId===own.id).length,10);
 }
 const durable=rooms.get(room.roomId);durable.object=new RoomObject(durable.state,{});
 room=(await request(`/${room.roomId}?playerId=${first.playerId}`,null,first.playerToken)).room;
 assert.equal(room.game.league.fixtureResults.length,30);
 await mutate(first,'submit');assert.equal(room.phase,'season-result');await mutate(second,'submit');assert.equal(room.phase,'offseason-events');
 for(const session of [first,second]){
  const snapshot=(await request(`/${room.roomId}?playerId=${session.playerId}`,null,session.playerToken)).room;
  const own=clubFor(session),events=snapshot.game.events[own.id];
  const actions=[...own.roster.filter(p=>p.contractYears<=0).map(p=>({type:'renew',playerId:p.id})),...events.retention.map(r=>({type:'retentionPay',playerId:r.playerId})),...events.special.map(r=>({type:'specialSkip',playerId:r.playerId}))];
  await mutate(session,'submit',{actions});
 }
 assert.equal(room.phase,'development');
 await mutate(first,'submit',{selections:[]},400);
 for(const session of [first,second]){
  const own=clubFor(session);await mutate(session,'submit',{selections:own.roster.slice(0,2).map(p=>({playerId:p.id,focus:trainingSkills(p)[0]}))});
 }
 assert.equal(room.phase,'growth-result');assert.equal(room.game.growth.length,6);
 await mutate(first,'submit');assert.equal(room.phase,'growth-result');await mutate(second,'submit');assert.equal(room.phase,'release');
 const player=clubFor(first).roster[0];await mutate(first,'rename',{playerId:player.id,name:'復帰テスト'});
 assert.equal(clubFor(first).roster.find(p=>p.id===player.id).name,'復帰テスト');
 const submitted=await mutate(first,'submit',{actions:[]});assert.equal(room.phase,'release');
 await mutate(second,'submit',{actions:[]});assert.equal(room.game.league.season,2);assert.equal(room.phase,'draft');
 const replay=await mutate(first,'submit',{},200,submitted.payload);assert.equal(replay.result.replayed,true);assert.equal(room.game.league.season,2);
 await mutate(second,'submit',{},409,{playerId:second.playerId,phaseRevision:1,requestId:crypto.randomUUID(),input:{}});
});
