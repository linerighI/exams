import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LANDING_KEY,ROLE_KEY,landingRequired,preferredRole,introductionKey,introductionRequired} from '../src/onboardingPolicy';
import type {Session} from '../src/types';
test('first-launch introduction is shown until a role is chosen and remembered independently of sign-in',()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)||null};
 assert.equal(landingRequired(storage),true);assert.equal(preferredRole(storage),'teacher');
 values.set(LANDING_KEY,'seen');values.set(ROLE_KEY,'student');
 assert.equal(landingRequired(storage),false);assert.equal(preferredRole(storage),'student');
 values.set(ROLE_KEY,'admin');assert.equal(preferredRole(storage),'teacher');
});
test('teacher/student film markers are isolated by account and school and contain no credentials',()=>{
 const storage={getItem:(_key:string)=>null};
 const teacher:Session={role:'teacher',token:'private-token',teacherId:'teacher-a'};
 const student={role:'student',token:'other-token',teacherId:'master',student:{id:'student-a'}} as Session;
 const a=introductionKey(teacher,'school-a'),b=introductionKey(student,'school-a');
 assert.notEqual(a,b);assert.notEqual(a,introductionKey({...teacher,teacherId:'teacher-b'},'school-a'));
 assert.notEqual(b,introductionKey({...student,student:{...student.student!,id:'student-b'}},'school-a'));
 assert.notEqual(a,introductionKey(teacher,'school-b'));assert.ok(!a.includes('private-token'));
 assert.equal(introductionRequired(storage,teacher,'school-a'),true);
 assert.equal(introductionRequired({getItem:key=>key===a?'seen':null},teacher,'school-a'),false);
 assert.equal(introductionRequired({getItem:key=>key===a?'seen':null},student,'school-a'),true);
});
test('blocked browser storage does not crash the first-launch or account intro policy',()=>{
 const storage={getItem:()=>{throw Error('Storage unavailable');}};
 assert.equal(landingRequired(storage),true);assert.equal(preferredRole(storage),'teacher');
 assert.equal(introductionRequired(storage,{role:'teacher',token:'secret'},'school'),true);
});
