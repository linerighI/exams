/* Only the parent supplies validated, bounded construction commands. No AI JavaScript is executed. */
let api;
const student=new URLSearchParams(location.search).get('student')==='1';
const applet=new GGBApplet({appName:student?'graphing':'classic',language:'ar',width:Math.max(280,innerWidth),height:Math.max(300,innerHeight),showToolBar:true,showMenuBar:false,showAlgebraInput:true,showKeyboardOnFocus:false,preventFocus:true,enableFileFeatures:false,appletOnLoad(a){api=a;a.setSize(Math.max(280,innerWidth),Math.max(300,innerHeight));parent.postMessage({type:'geometry-ready'},location.origin);}},true);
window.addEventListener('resize',()=>api?.setSize(Math.max(280,innerWidth),Math.max(300,innerHeight)));
applet.setHTML5Codebase('GeoGebra/HTML5/5.0/web3d/');
applet.inject('geometry');
window.addEventListener('message',e=>{
 if(e.source!==parent||!api)return;
 if(e.data?.type==='geometry-load'&&typeof e.data.ggb==='string'&&e.data.ggb.length<5000000&&/^[A-Za-z0-9+/=]+$/.test(e.data.ggb))api.setBase64(e.data.ggb);
 if(e.data?.type==='geometry-build'&&Array.isArray(e.data.commands)&&e.data.commands.length<=50){
  const safe=/^[A-Za-z][A-Za-z0-9_]{0,15}=(?:\(-?[\d.]+,-?[\d.]+\)|(?:Circle|Line|Segment|Angle)\([A-Za-z0-9_,.\-]+\)|Text\("[A-Za-z0-9 α-ωΑ-Ω=+\-°]{1,30}",\(-?[\d.]+,-?[\d.]+\)\))$/;
  const polynomial=/^[A-Za-z][A-Za-z0-9_]{0,15}\(x\)=-?\d+(?:\.\d+)?(?:\*x\^[0-6])?(?:[+-]\d+(?:\.\d+)?(?:\*x\^[0-6])?){0,6}$/;
  if(!e.data.commands.every(c=>typeof c==='string'&&c.length<500&&(safe.test(c)||polynomial.test(c))))return;
  api.reset();for(const command of e.data.commands){if(!api.evalCommand(command)){parent.postMessage({type:'geometry-error',message:'تعذر إنشاء عنصر هندسي'},location.origin);return;}}
  parent.postMessage({type:'geometry-built'},location.origin);
 }
 if(e.data?.type==='geometry-export'){const image='data:image/png;base64,'+api.getPNGBase64(2,false,144);api.getBase64(ggb=>parent.postMessage({type:'geometry-exported',image,ggb},'*'));}
});
