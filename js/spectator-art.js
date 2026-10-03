export function drawSpectator(ctx,i,color){
 const skin=['#f3cca6','#deb08c','#bb8364','#805840'][i%4];
 const hair=['#342c32','#634334','#b78649','#d4bc86','#666078'][i%5];
 ctx.lineWidth=4;ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#302e3d';
 const ellipse=(x,y,rx,ry,fill)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.stroke();};
 const shape=(points,fill)=>{ctx.beginPath();points.forEach(([x,y],n)=>n?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.stroke();};
 // Rounded silhouettes, warm outlines, and muted clubhouse colours.
 ellipse(74,170,18,9,'#343844');ellipse(117,170,18,9,'#343844');
 shape([[67,132],[125,132],[130,162],[107,164],[96,145],[84,164],[61,162]],'#596075');
 ellipse(96,118,34,34,color);
 const cheer=i%4===0, scarf=i%4===1;
 ellipse(cheer?48:61,cheer?73:123,11,cheer?28:23,color);
 ellipse(cheer?144:132,cheer?73:123,11,cheer?28:23,color);
 ellipse(cheer?48:59,cheer?47:141,10,10,skin);ellipse(cheer?144:134,cheer?47:141,10,10,skin);
 ellipse(96,57,38,39,hair);
 ellipse(96,65,31,31,skin);
 // Five distinct hair silhouettes, with four accessory/pose families.
 if(i%5===0)shape([[61,48],[66,27],[82,34],[96,19],[105,34],[126,29],[133,49],[112,43],[97,47],[80,43]],hair);
 if(i%5===1)shape([[61,52],[69,30],[110,25],[130,44],[118,56],[102,38],[89,54]],hair);
 if(i%5===2){ellipse(62,69,9,22,hair);ellipse(130,69,9,22,hair);shape([[62,44],[76,25],[117,29],[130,47],[109,42],[94,48],[77,42]],hair);}
 if(i%5===3)shape([[63,44],[77,25],[116,26],[130,44],[116,51],[106,39],[94,53],[81,39],[73,52]],hair);
 if(i%5===4){ellipse(70,34,13,13,hair);ellipse(92,29,14,13,hair);ellipse(115,34,14,13,hair);}
 ctx.fillStyle='#302e3d';ctx.fillRect(81,62,5,7);ctx.fillRect(107,62,5,7);
 ctx.beginPath();ctx.moveTo(90,79);ctx.quadraticCurveTo(96,85,103,79);ctx.stroke();
 ctx.fillStyle='#dc988b';ctx.globalAlpha=.5;ctx.fillRect(72,74,10,4);ctx.fillRect(112,74,10,4);ctx.globalAlpha=1;
 if(i%4===2){ctx.strokeRect(73,57,20,17);ctx.strokeRect(101,57,20,17);ctx.beginPath();ctx.moveTo(93,63);ctx.lineTo(101,63);ctx.stroke();}
 if(i%4===3){shape([[59,39],[68,24],[119,24],[132,39]],color);shape([[56,39],[137,39],[140,47],[57,47]],'#dbbe7b');}
 if(scarf){shape([[62,98],[128,98],[128,111],[62,111]],'#e5cc8c');shape([[111,107],[125,107],[122,141],[109,137]],'#e5cc8c');ctx.fillStyle=color;for(let x=68;x<127;x+=16)ctx.fillRect(x,100,7,9);}
 else{ctx.fillStyle='#e5cc8c';ctx.fillRect(89,110,14,13);}
}

