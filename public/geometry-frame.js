/* Only the parent supplies validated, bounded construction commands. No AI JavaScript is executed. */
let api;
const applet=new GGBApplet({appName:'geometry',language:'ar',width:760,height:460,showToolBar:true,showMenuBar:false,showAlgebraInput:false,enableFileFeatures:false,appletOnLoad(a){api=a;parent.postMessage({type:'geometry-ready'},'*');}},true);
applet.setHTML5Codebase('GeoGebra/HTML5/5.0/web3d/');
applet.inject('geometry');
window.addEventListener('message',e=>{
 if(e.source!==parent||!api)return;
 if(e.data?.type==='geometry-load'&&typeof e.data.ggb==='string'&&e.data.ggb.length<5000000&&/^[A-Za-z0-9+/=]+$/.test(e.data.ggb))api.setBase64(e.data.ggb);
 if(e.data?.type==='geometry-build'&&Array.isArray(e.data.commands)&&e.data.commands.length<=50){
  const safe=/^[A-Za-z][A-Za-z0-9_]{0,15}=(?:\(-?[\d.]+,-?[\d.]+\)|(?:Circle|Line|Segment|Angle)\([A-Za-z0-9_,.\-]+\)|Text\("[A-Za-z0-9 α-ωΑ-Ω=+\-°]{1,30}",\(-?[\d.]+,-?[\d.]+\)\))$/;
  if(!e.data.commands.every(c=>typeof c==='string'&&safe.test(c)))return;
  api.reset();for(const command of e.data.commands){if(!api.evalCommand(command)){parent.postMessage({type:'geometry-error',message:'تعذر إنشاء عنصر هندسي'},'*');return;}}
 }
 if(e.data?.type==='geometry-export'){const image='data:image/png;base64,'+api.getPNGBase64(2,false,144);api.getBase64(ggb=>parent.postMessage({type:'geometry-exported',image,ggb},'*'));}
});
