/* No external packages: minimal OPC/OOXML DOCX writer with escaped content. */
import zlib from 'node:zlib';
import {Snapshot} from './domain.js';
function crc32(b:any):number{let crc=-1;for(const byte of b){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^-1)>>>0;}
function zip(files:{name:string;content:string}[]):any{
 const locals:any[]=[],cd:any[]=[];let offset=0;const date=0,time=0;
 for(const file of files){const name=Buffer.from(file.name),raw=Buffer.from(file.content,'utf8'),packed=zlib.deflateRawSync(raw,{level:6}),crc=crc32(raw);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(8,8);local.writeUInt16LE(time,10);local.writeUInt16LE(date,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);locals.push(local,name,packed);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0,8);c.writeUInt16LE(8,10);c.writeUInt16LE(time,12);c.writeUInt16LE(date,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(0,38);c.writeUInt32LE(offset,42);cd.push(c,name);offset+=local.length+name.length+packed.length;
 }
 const central=Buffer.concat(cd);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,central,end]);
}
export function escapeXml(x:string):string{return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');}
const run=(s:string,bold=false,color='263340')=>`<w:r><w:rPr>${bold?'<w:b/>':''}<w:color w:val="${color}"/><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">${escapeXml(s)}</w:t></w:r>`;
function p(s:string,style?:string){return `<w:p><w:pPr>${style?`<w:pStyle w:val="${style}"/>`:''}<w:spacing w:after="100"/></w:pPr>${run(s)}</w:p>`;}
const heading=(s:string)=>`<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="250" w:after="100"/><w:keepNext/></w:pPr>${run(s,true,'17334A')}</w:p>`;
const widths=[1450,3600,900,900,1450,1200];
const cell=(s:string,i:number)=>`<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>${p(s)}</w:tc>`;
const row=(values:string[],header=false)=>`<w:tr>${header?'<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>':'<w:trPr><w:cantSplit/></w:trPr>'}${values.map((v,i)=>cell(v,i)).join('')}</w:tr>`;
function table(rows:string[][]){return `<w:tbl><w:tblPr><w:tblW w:w="9500" w:type="dxa"/><w:tblBorders><w:bottom w:val="single" w:sz="4" w:color="DCE3E8"/><w:insideH w:val="single" w:sz="4" w:color="DCE3E8"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map((r,i)=>row(r,i===0)).join('')}</w:tbl>`;}
export function renderDocx(s:Snapshot):any{
 if(JSON.stringify(s).includes('[UNFILLED]')||JSON.stringify(s).includes('[UNKNOWN]'))throw new Error('Cannot export unresolved or unknown values');
 let body=`<w:p><w:pPr><w:pStyle w:val="Title"/><w:spacing w:after="90"/></w:pPr>${run(s.title,true,'143954')}</w:p>`;
 body+=`<w:p><w:pPr><w:spacing w:after="260"/></w:pPr>${run(s.marker,true,'A43E3E')}</w:p>`;
 body+=p(s.organization)+p(`${s.templateName} · version ${s.templateVersion} · week beginning ${s.weekStart}`)+p(`Department: ${s.department} · Prepared by: ${s.preparer} (${s.role})`);
 body+=heading('Guided responses');for(const f of s.fields)body+=p(`${f.label}: ${f.value}`);
 for(const b of s.blocks)body+=heading(b.label)+p(b.text);
 body+=heading('Service time entries');body+=table([['Date','Activity and supporting notes','Start','End','Unpaid break','Net hours'],...s.entries.map(x=>[x.serviceDate,x.activity,x.start,x.end,String(x.breakMinutes)+' min',x.hours.toFixed(2)])]);
 if(s.entries.some(x=>x.notes.trim())) {body+=heading('Supporting activity notes');for(const x of s.entries.filter(x=>x.notes.trim()))body+=p(`${x.serviceDate} · ${x.activity}: ${x.notes}`);}
 body+=heading(`Total net service hours: ${s.totalHours.toFixed(2)}`);body+=p(s.footer);body+=p(`Audit reference: ${s.formId} · answer revision ${s.revision} · template v${s.templateVersion}`);
 const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1100" w:right="950" w:bottom="1100" w:left="950" w:header="550" w:footer="550"/></w:sectPr></w:body></w:document>`;
 return zip([
 {name:'[Content_Types].xml',content:'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'},
 {name:'_rels/.rels',content:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
 {name:'word/_rels/document.xml.rels',content:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
 {name:'word/document.xml',content:xml},
 {name:'word/styles.xml',content:'<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="37"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="25"/></w:rPr></w:style></w:styles>'}
 ]);
}
