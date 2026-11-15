const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const viewports = [{width:1366,height:768},{width:390,height:844}];
const inspect = async page => page.evaluate(async () => {
  const title=document.querySelector('.detail h1'), cover=document.querySelector('.detail .work-media'), img=cover?.querySelector('img');
  const rect=el=>el&&Object.fromEntries(['x','y','top','right','bottom','left','width','height'].map(k=>[k,el.getBoundingClientRect()[k]]));
  const css=el=>el&&((s)=>({display:s.display,opacity:s.opacity,visibility:s.visibility,transform:s.transform,height:s.height,position:s.position}))(getComputedStyle(el));
  const scroll=[...document.querySelectorAll('*')].filter(el=>['auto','scroll','hidden'].includes(getComputedStyle(el).overflowY)).map(el=>({tag:el.tagName,class:el.className,scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}));
  const response=img?.currentSrc?await fetch(img.currentSrc,{method:'HEAD'}).then(r=>r.status).catch(()=>0):0;
  return {url:location.href,titleText:title?.textContent?.trim(),scroll,rects:{dock:rect(document.querySelector('.dock')),h1:rect(title),cover:rect(cover),type:rect(document.querySelector('.detail .pill')),version:rect(document.querySelectorAll('.detail .pill')[1])},h1:css(title),cover:css(cover),image:img&&{complete:img.complete,naturalWidth:img.naturalWidth,currentSrc:img.currentSrc,status:response}};
});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:chrome});for(const viewport of viewports){for(const mode of ['direct','from-list']){const page=await browser.newPage({viewport,deviceScaleFactor:1});if(mode==='direct')await page.goto(`${base}/works/2`,{waitUntil:'networkidle'});else{await page.goto(`${base}/works`,{waitUntil:'networkidle'});await page.locator('.stage').evaluate(e=>e.scrollTop=600);const visit=page.locator('.work-card .btn.primary').first();if(await visit.count())await visit.click();else await page.goto(`${base}/works/2`);}await page.waitForTimeout(1500);console.log(JSON.stringify({viewport,mode,data:await inspect(page)},null,2));await page.screenshot({path:`design-assets/qa/detail-${mode}-${viewport.width}.png`,fullPage:false});await page.close()}}await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
