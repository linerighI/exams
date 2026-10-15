import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageContent, lessonExcerpt } from '../src/sourceContent';
import { generate } from '../server/ai';
import { geminiGenerate } from '../server/gemini';
test('الحشو مستبعد ومحتوى الدرس والمعادلات باقٍ', () => {
  for (const text of ['قائمةُ المحتوياتِ\nالدرس الأول 8 والدرس الثاني 18', 'المقدمة\nهذه مقدمة عامة طويلة للكتاب وليس شرح درس', 'فريق التأليف\nالرياضيات الصف العاشر كتاب الطالب', '© HarperCollins 2020 ISBN 123456', '1']) assert.equal(pageContent({page:1,text,images:[]}).included,false,text);
  assert.equal(pageContent({page:8,text:'حل المعادلات بإخراج العامل المشترك: x^3+4x^2=5x',images:[]}).included,true);
  assert.ok(lessonExcerpt('مقدمة نص دراسي طويلة '.repeat(100)+'\nالمعادلات المستخرجة من الصفحة (الأسس بصيغة ^):\nx^3 + 4x^2 = 5x',1200).includes('x^3 + 4x^2 = 5x'));
});
test('Gemini يرسل الصفحات الدراسية فقط ويصحح نقص العدد ويحافظ على مصدر الأسئلة', async()=>{
  const original=globalThis.fetch;
  let calls=0;
  const source={id:'s',name:'PDF',pages:[{page:1,text:'قائمة المحتويات\nالدروس في هذا الكتاب 8 10 12',images:[]},{page:8,text:'الشمس مصدر طاقة دورة الماء والماء يتبخر بفعل حرارة الشمس.',images:[]}]};
  try {
    globalThis.fetch=(async (url:any,init:any)=>{
      assert.ok(String(url).startsWith('https://generativelanguage.googleapis.com/'));
      assert.equal(init.headers['x-goog-api-key'],'test-key');
      const body=JSON.parse(init.body);
      assert.equal(body.generationConfig.responseMimeType,'application/json');
      assert.ok(!body.contents[0].parts[0].text.includes('قائمة المحتويات'));
      const i=++calls;
      const q={text:`ما دور الشمس في دورة الماء في السؤال ${i}؟`,options:['التبخر','التكاثف','الهطول','التجمد'],correct:0,explanation:'حرارة الشمس تسبب التبخر',page:8};
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({questions:[q]})}]},finishReason:'STOP'}]}));
    }) as any;
    const questions=await generate(source,[1,8],2,'سهل','gemini-2.5-flash',new AbortController().signal,()=>{},{provider:'gemini',key:'test-key'});
    assert.equal(questions.length,2);
    assert.ok(questions.every((q)=>q.page===8));
  } finally {globalThis.fetch=original;}
});
test('المحلي يعيد عددًا جزئيًا قابلًا للإكمال بدل فقده عند انتهاء المحاولات',async()=>{
  const original=globalThis.fetch;
  let calls=0;
  const q={id:'existing',text:'ما الكوكب الذي نعيش عليه؟',options:['الأرض','المريخ','زحل','عطارد'],correct:0,explanation:'من الدرس',page:8};
  try {
    globalThis.fetch=(async()=>{calls++;return new Response(JSON.stringify({message:{content:'{"questions":[]}'}}));}) as any;
    const result=await generate({id:'s',name:'PDF',pages:[{page:8,text:'الأرض كوكب من المجموعة الشمسية يدور حول الشمس.',images:[]}]},[8],2,'سهل','qwen3:1.7b',new AbortController().signal,()=>{},{existing:[q]});
    assert.equal(result[0].id,'existing'); assert.equal(result.length,1); assert.ok(calls>0);
  }finally{globalThis.fetch=original;}
});
test('Gemini يعرض أخطاء المفتاح والحصة دون كشف المفتاح',async()=>{
  const original=globalThis.fetch;
  try {
    for(const [status,pattern] of [[403,/مفتاح/],[429,/حد الاستخدام/],[404,/غير متاح/]] as const){
      globalThis.fetch=(async()=>new Response(JSON.stringify({error:{message:'sensitive-key'}}),{status})) as any;
      await assert.rejects(()=>geminiGenerate('gemini-2.5-flash','sensitive-key','system','prompt',{},new AbortController().signal),pattern);
    }
  } finally {globalThis.fetch=original;}
});
