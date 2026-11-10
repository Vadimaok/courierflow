(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const months=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const days=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const types={
    off:{label:'Выходной',short:'Выходной',cls:'shift-off',color:'#32aafa',icon:'⌂'},
    work:{label:'Работа',short:'Работа',cls:'shift-work',color:'#ff5b69',icon:'ОТ'},
    busy:{label:'Занят',short:'Занят',cls:'shift-busy',color:'#b276ef',icon:'●'},
    sick:{label:'Больничный',short:'Больничный',cls:'shift-sick',color:'#7295ff',icon:'✚'},
    night:{label:'Ночная смена',short:'Ночная',cls:'shift-night',color:'#292f9c',icon:'☾'},
    vacation:{label:'Отпуск',short:'Отпуск',cls:'shift-vacation',color:'#269b78',icon:'✦'}
  };
  const today=new Date(); let view=new Date(today.getFullYear(),today.getMonth(),1),selected=key(today),tab='calendar',selectedType='night',selectMode=false,marked=new Set(),toastTimer;
  const defaults={rate:0,currency:'PLN',weekStart:1,defaultType:'night',defaultStart:'19:00',defaultEnd:'09:00',defaultHours:14,haptics:false,compact:false};
  let data=load();
  function key(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
  function parse(k){const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)}
  function load(){try{const x=JSON.parse(localStorage.getItem('myhelp-data'))||{};return {...defaults,...x,shifts:x.shifts||{},templates:x.templates||[]}}catch{return {...defaults,shifts:{},templates:[]}}}
  function save(){localStorage.setItem('myhelp-data',JSON.stringify(data))}
  function notify(s){const el=$('#toast');el.textContent=s;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),2200)}
  function money(v){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v)+' '+({PLN:'zł',RUB:'₽',EUR:'€',USD:'$'}[data.currency]||'zł')}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function haptic(){if(data.haptics&&navigator.vibrate)navigator.vibrate(10)}
  function shifts(k){return data.shifts[k]||[]}
  function title(){return months[view.getMonth()]}
  function render(){
    document.body.classList.toggle('light-theme',data.theme==='light');
    $('#monthTitle').textContent=title();$('#monthEyebrow').textContent=tab==='calendar'?'МОЙ ГРАФИК':'MY HELP';
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    $('#todayBtn').innerHTML=selectMode?'✓':'▦';$('#todayBtn').setAttribute('aria-label',selectMode?'Завершить выбор':'Сегодня');
    const screen=$('#screen');screen.innerHTML=tab==='calendar'?calendar():tab==='reports'?reports():tab==='templates'?templates():settings();
  }
  function calendar(){
    const first=new Date(view.getFullYear(),view.getMonth(),1),offset=(first.getDay()-data.weekStart+7)%7,count=new Date(view.getFullYear(),view.getMonth()+1,0).getDate(),total=Math.ceil((offset+count)/7)*7;
    const week=Array.from({length:7},(_,i)=>days[(i+data.weekStart)%7]);
    let cells='';
    for(let i=0;i<total;i++){const d=new Date(view.getFullYear(),view.getMonth(),1-offset+i),k=key(d),inMonth=d.getMonth()===view.getMonth(),items=shifts(k),isMarked=marked.has(k);
      cells+=`<button class="day ${inMonth?'':'outside'} ${k===selected?'selected':''} ${k===key(today)?'today':''} ${isMarked?'marked':''}" data-day="${k}" aria-pressed="${isMarked}"><span class="day-number">${d.getDate()}</span>${items.length?items.slice(0,2).map(s=>`<span class="shift-pill ${types[s.type]?.cls||'shift-night'}">${esc(s.title||types[s.type]?.short||'Смена')}</span>`).join(''):'<span class="day-empty"></span>'}${selectMode?'<span class="pick-mark">'+(isMarked?'✓':'＋')+'</span>':''}</button>`;
    }
    const selectionBar=selectMode?`<div class="bulk-panel"><div class="bulk-head"><strong>Выбрано: ${marked.size} дн.</strong><button id="selectAll">Выбрать месяц</button><button id="clearMarked">Сбросить</button></div><div class="bulk-actions"><select id="bulkType">${Object.entries(types).map(([k,t])=>`<option value="${k}">${t.label}</option>`).join('')}</select><button class="primary-btn" id="applyBulk" ${marked.size?'':'disabled'}>Применить к дням</button></div><button class="text-btn" id="finishSelect">Завершить выбор</button></div>`:'';
    return `<div class="month-nav"><button id="prevMonth" aria-label="Предыдущий месяц">‹</button><strong>${title()} ${view.getFullYear()}</strong><div class="month-actions"><button id="selectModeBtn">${selectMode?'Готово':'Выбрать дни'}</button><button id="nextMonth" aria-label="Следующий месяц">›</button></div></div><div class="weekdays">${week.map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-grid ${data.compact?'compact':''}">${cells}</div>${selectionBar}<div class="calendar-legend">${Object.entries(types).map(([k,t])=>`<span class="legend"><i style="background:${t.color}"></i>${t.label}</span>`).join('')}</div>${!selectMode?'<button class="quick-add" id="quickAdd" aria-label="Добавить смену">＋</button>':''}`;
  }
  function monthEntries(){const prefix=key(new Date(view.getFullYear(),view.getMonth(),1)).slice(0,7)+'-';return Object.entries(data.shifts).filter(([k])=>k.startsWith(prefix)).flatMap(([date,arr])=>arr.map(s=>({...s,date})))}
  function reports(){
    const rows=monthEntries(),work=rows.filter(x=>['night','work'].includes(x.type)),hours=work.reduce((a,x)=>a+Number(x.hours||0),0),income=hours*Number(data.rate||0);
    return `<h2 class="section-title">Отчёты</h2><div class="month-nav"><button id="prevMonth">‹</button><strong>${title()} ${view.getFullYear()}</strong><button id="nextMonth">›</button></div><div class="card"><h3 class="card-title">Итоги за месяц</h3><div class="metric-row"><span>Рабочих часов</span><strong>${hours} ч</strong></div><div class="metric-row"><span>Рабочих смен</span><strong>${work.length}</strong></div><div class="metric-row"><span>Занятых дней</span><strong>${rows.filter(x=>x.type==='busy').length}</strong></div><div class="metric-row"><span>Выходные</span><strong>${rows.filter(x=>x.type==='off').length}</strong></div><div class="metric-row"><span>Больничные</span><strong>${rows.filter(x=>x.type==='sick').length}</strong></div><div class="metric-row"><span>Отпуск</span><strong>${rows.filter(x=>x.type==='vacation').length}</strong></div></div><div class="metric-grid"><div class="metric-tile"><span>Расчётный доход</span><strong>${money(income)}</strong></div><div class="metric-tile"><span>Ставка за час</span><strong>${money(Number(data.rate||0))}</strong></div></div><button class="secondary-btn full" id="rateBtn">Настроить оплату</button><button class="secondary-btn full" id="exportCsv">Экспорт отчёта CSV</button>`;
  }
  function templates(){return `<h2 class="section-title">Типы занятости</h2><div class="card">${Object.entries(types).map(([k,t])=>`<div class="template-row"><span class="template-icon" style="background:${t.color};color:white">${t.icon}</span><div class="template-copy"><strong>${t.label}</strong><small>${k==='night'?'Ночная смена':k==='work'?'Рабочий день':k==='busy'?'Личные дела / занят':'Отметка на весь день'}</small></div><button class="chevron" data-add-type="${k}" aria-label="Добавить ${t.label}">＋</button></div>`).join('')}</div><h2 class="section-title">Циклический график</h2><div class="card"><p class="muted small-copy">Заполни месяц повторяющимся графиком. Уже отмеченные дни будут заменены.</p><div class="field"><label>Рабочих дней подряд</label><input id="workDays" type="number" min="1" max="31" value="2"></div><div class="field"><label>Дней отдыха подряд</label><input id="restDays" type="number" min="1" max="31" value="2"></div><div class="field"><label>Начало цикла</label><input id="patternStart" type="date" value="${selected}"></div><div class="field"><label>Рабочий тип</label><select id="patternType"><option value="night">Ночная смена</option><option value="work">Работа</option></select></div><button class="primary-btn full" id="applyPattern">Заполнить месяц</button></div>`}
  function settings(){return `<h2 class="section-title">Настройки</h2><div class="card"><h3 class="card-title left-title">Рабочее время</h3><div class="field"><label>Почасовая ставка</label><input id="settingRate" type="number" min="0" step="0.01" value="${data.rate}"></div><div class="field"><label>Валюта</label><select id="settingCurrency">${[['PLN','Польский злотый (zł)'],['RUB','Российский рубль (₽)'],['EUR','Евро (€)'],['USD','Доллар ($)']].map(([v,l])=>`<option value="${v}" ${data.currency===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label>Смена по умолчанию</label><select id="settingType">${Object.entries(types).map(([k,t])=>`<option value="${k}" ${data.defaultType===k?'selected':''}>${t.label}</option>`).join('')}</select></div><div class="field two-fields"><div><label>Начало</label><input id="settingStart" type="time" value="${data.defaultStart}"></div><div><label>Окончание</label><input id="settingEnd" type="time" value="${data.defaultEnd}"></div></div><div class="field"><label>Часов в смене по умолчанию</label><input id="settingHours" type="number" min="0" max="24" step=".5" value="${data.defaultHours}"></div><button class="primary-btn full" id="saveSettings">Сохранить настройки</button></div><div class="card"><h3 class="card-title left-title">Календарь</h3><div class="field"><label>Первый день недели</label><select id="settingWeek"><option value="1" ${data.weekStart===1?'selected':''}>Понедельник</option><option value="0" ${data.weekStart===0?'selected':''}>Воскресенье</option></select></div><div class="settings-row"><span>Компактный календарь</span><button class="switch ${data.compact?'on':''}" id="toggleCompact" aria-label="Компактный календарь"></button></div><div class="settings-row"><span>Виброотклик при выборе</span><button class="switch ${data.haptics?'on':''}" id="toggleHaptics" aria-label="Виброотклик"></button></div><div class="field"><label>Оформление</label><select id="settingTheme"><option value="dark" ${data.theme!=='light'?'selected':''}>Тёмное</option><option value="light" ${data.theme==='light'?'selected':''}>Светлое</option></select></div><button class="primary-btn full" id="saveCalendarSettings">Применить</button></div><div class="card"><h3 class="card-title left-title">Резервная копия</h3><p class="muted small-copy">Экспортируй график в файл и перенеси его на другое устройство. Данные пока сохраняются только в этом браузере.</p><div class="action-row"><button class="secondary-btn" id="exportData">Экспорт JSON</button><button class="secondary-btn" id="importData">Импорт JSON</button></div><input id="importFile" type="file" accept="application/json" hidden><button class="danger-btn" id="clearAll">Удалить весь график</button></div><p class="muted footer-note">My help · 0.2.0</p>`}
  function openSheet(t,html){$('#sheetTitle').textContent=t;$('#sheetContent').innerHTML=html;$('#sheetBackdrop').classList.remove('hidden')}
  function closeSheet(){$('#sheetBackdrop').classList.add('hidden')}
  function addForm(date,type= data.defaultType){
    selected=date;selectedType=type;const old=shifts(date)[0]||{},t=types[type];
    openSheet(old.type?'Изменить занятость':'Добавить занятость',`<p class="muted small-copy">${parse(date).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</p><div class="field"><label>Тип дня</label><div class="type-options">${Object.entries(types).map(([k,v])=>`<button class="type-option ${k===selectedType?'selected':''}" data-type="${k}"><i class="type-dot" style="background:${v.color}"></i>${v.label}</button>`).join('')}</div></div><div class="field"><label>Название</label><input id="shiftTitle" placeholder="${t.short}" value="${esc(old.title||'')}"></div><div class="field two-fields"><div><label>Начало</label><input id="shiftStart" type="time" value="${old.start||data.defaultStart}"></div><div><label>Окончание</label><input id="shiftEnd" type="time" value="${old.end||data.defaultEnd}"></div></div><div class="field"><label>Часов для отчёта</label><input id="shiftHours" type="number" min="0" max="24" step=".5" value="${old.hours??data.defaultHours}"></div><div class="action-row"><button class="secondary-btn" id="cancelSheet">Отмена</button><button class="primary-btn" id="saveShift">Сохранить</button></div>${old.type?'<button class="danger-btn" id="deleteShift">Удалить отметку дня</button>':''}`);$('#sheetContent').dataset.date=date;
  }
  function applyPattern(){const work=Math.max(1,Math.min(31,Number($('#workDays').value)||2)),rest=Math.max(1,Math.min(31,Number($('#restDays').value)||2)),start=parse($('#patternStart').value||selected),type=$('#patternType').value,cycle=work+rest,last=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();for(let n=1;n<=last;n++){const d=new Date(view.getFullYear(),view.getMonth(),n),pos=Math.floor((d-start)/86400000)%cycle;if(pos<0)continue;data.shifts[key(d)]=pos<work?[{type,title:types[type].short,hours:type==='night'?data.defaultHours:8,start:data.defaultStart,end:data.defaultEnd}]:[{type:'off',title:'Выходной',hours:0}]};save();tab='calendar';render();notify('График заполнен')}
  function csv(){const rows=[['Дата','Тип','Название','Начало','Окончание','Часы']];monthEntries().sort((a,b)=>a.date.localeCompare(b.date)).forEach(x=>rows.push([x.date,types[x.type]?.label||x.type,x.title||'',x.start||'',x.end||'',x.hours||0]));const blob=new Blob(['\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-help-report-'+key(view).slice(0,7)+'.csv';a.click();URL.revokeObjectURL(url)}
  function exportJson(){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-help-backup.json';a.click();URL.revokeObjectURL(url)}
  function toggleSet(k){marked.has(k)?marked.delete(k):marked.add(k);haptic();render()}
  $('#screen').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.day){if(selectMode){toggleSet(b.dataset.day);return}selected=b.dataset.day;addForm(selected);return}
    if(b.id==='prevMonth'){view=new Date(view.getFullYear(),view.getMonth()-1,1);marked.clear();render()}
    if(b.id==='nextMonth'){view=new Date(view.getFullYear(),view.getMonth()+1,1);marked.clear();render()}
    if(b.id==='quickAdd')addForm(selected);
    if(b.id==='selectModeBtn'){selectMode=!selectMode;marked.clear();render()}
    if(b.id==='finishSelect'){selectMode=false;marked.clear();render()}
    if(b.id==='selectAll'){const n=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();for(let d=1;d<=n;d++)marked.add(key(new Date(view.getFullYear(),view.getMonth(),d)));render()}
    if(b.id==='clearMarked'){marked.clear();render()}
    if(b.id==='applyBulk'){const type=$('#bulkType').value;marked.forEach(k=>{data.shifts[k]=[{type,title:types[type].short,hours:['night','work'].includes(type)?(type==='night'?data.defaultHours:8):0,start:data.defaultStart,end:data.defaultEnd}]});const n=marked.size;save();marked.clear();selectMode=false;render();notify('Обновлено дней: '+n)}
    if(b.id==='rateBtn')openSheet('Почасовая ставка',`<div class="field"><label>Ставка за час</label><input id="rateInput" type="number" min="0" step=".01" value="${data.rate}"></div><button class="primary-btn full" id="saveRate">Сохранить</button>`);
    if(b.dataset.addType){addForm(selected,b.dataset.addType)}
    if(b.id==='applyPattern')applyPattern();
    if(b.id==='exportData')exportJson();if(b.id==='exportCsv')csv();if(b.id==='importData')$('#importFile').click();
    if(b.id==='toggleCompact'){data.compact=!data.compact;save();render()}
    if(b.id==='toggleHaptics'){data.haptics=!data.haptics;save();render()}
    if(b.id==='clearAll')openSheet('Удалить весь график?',`<p class="small-copy muted">Все отметки календаря будут удалены. Это действие нельзя отменить.</p><div class="action-row"><button class="secondary-btn" id="cancelSheet">Отмена</button><button class="danger-btn" id="confirmClear">Удалить всё</button></div>`);
    if(b.id==='saveSettings'){data.rate=Number($('#settingRate').value)||0;data.currency=$('#settingCurrency').value;data.defaultType=$('#settingType').value;data.defaultStart=$('#settingStart').value||'09:00';data.defaultEnd=$('#settingEnd').value||'17:00';data.defaultHours=Math.max(0,Math.min(24,Number($('#settingHours').value)||8));save();render();notify('Настройки сохранены')}
    if(b.id==='saveCalendarSettings'){data.weekStart=Number($('#settingWeek').value);data.theme=$('#settingTheme').value;save();render();notify('Календарь обновлён')}
  });
  $('#sheetContent').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.type){selectedType=b.dataset.type;$('#sheetContent').querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('selected',x.dataset.type===selectedType));return}
    if(b.id==='cancelSheet')closeSheet();
    if(b.id==='saveShift'){const date=$('#sheetContent').dataset.date,type=selectedType;data.shifts[date]=[{type,title:$('#shiftTitle').value.trim()||types[type].short,start:$('#shiftStart').value,end:$('#shiftEnd').value,hours:Number($('#shiftHours').value)||0}];save();closeSheet();render();notify('Отметка сохранена')}
    if(b.id==='deleteShift'){delete data.shifts[$('#sheetContent').dataset.date];save();closeSheet();render();notify('Отметка удалена')}
    if(b.id==='saveRate'){data.rate=Math.max(0,Number($('#rateInput').value)||0);save();closeSheet();render();notify('Ставка сохранена')}
    if(b.id==='confirmClear'){data.shifts={};save();closeSheet();render();notify('График очищен')}
  });
  $('#closeSheet').addEventListener('click',closeSheet);$('#sheetBackdrop').addEventListener('click',e=>{if(e.target.id==='sheetBackdrop')closeSheet()});
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;selectMode=false;marked.clear();render()}));
  $('#todayBtn').addEventListener('click',()=>{if(selectMode){selectMode=false;marked.clear();render();return}view=new Date(today.getFullYear(),today.getMonth(),1);selected=key(today);tab='calendar';render()});
  $('#importFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const x=JSON.parse(await f.text());if(!x||typeof x.shifts!=='object')throw Error();data={...defaults,...x,shifts:x.shifts};save();render();notify('Резервная копия восстановлена')}catch{notify('Не удалось открыть файл')}e.target.value=''});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  render();
})();