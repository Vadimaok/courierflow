(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const monthNames = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const types = {
    off:{label:'Выходной',short:'Выходной',cls:'shift-off',color:'#32aafa',icon:'⌂'},
    work:{label:'Отработано',short:'Работа',cls:'shift-work',color:'#ff5b69',icon:'ОТ'},
    sick:{label:'Больничный',short:'Больничный',cls:'shift-sick',color:'#7295ff',icon:'✚'},
    night:{label:'Ночная смена',short:'Ночная',cls:'shift-night',color:'#292f9c',icon:'☾'},
    vacation:{label:'Отпуск',short:'Отпуск',cls:'shift-vacation',color:'#269b78',icon:'✦'}
  };
  const today = new Date();
  let view = new Date(today.getFullYear(),today.getMonth(),1);
  let selected = key(today);
  let tab = 'calendar';
  let selectedType = 'night';
  let toastTimer;
  let data = load();
  function key(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
  function parse(k){const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)}
  function load(){try{return JSON.parse(localStorage.getItem('myhelp-data'))||{shifts:{},rate:0,templates:[]}}catch{return {shifts:{},rate:0,templates:[]}}}
  function save(){localStorage.setItem('myhelp-data',JSON.stringify(data))}
  function notify(s){const el=$('#toast');el.textContent=s;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),2300)}
  function monthTitle(){return monthNames[view.getMonth()]}
  function shiftFor(k){return data.shifts[k]||[]}
  function render(){ $('#monthTitle').textContent=monthTitle();$('#monthEyebrow').textContent=tab==='calendar'?'МОЙ ГРАФИК':'MY HELP'; document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); const screen=$('#screen'); screen.innerHTML=tab==='calendar'?calendar():tab==='reports'?reports():tab==='templates'?templates():settings(); }
  function calendar(){
    const first=new Date(view.getFullYear(),view.getMonth(),1), start=(first.getDay()+6)%7, count=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
    const total=Math.ceil((start+count)/7)*7;
    let cells='';
    for(let i=0;i<total;i++){const d=new Date(view.getFullYear(),view.getMonth(),1-start+i), k=key(d), inMonth=d.getMonth()===view.getMonth(), items=shiftFor(k);
      cells+=`<button class="day ${inMonth?'':'outside'} ${k===selected?'selected':''} ${k===key(today)?'today':''}" data-day="${k}"><span class="day-number">${d.getDate()}</span>${items.length?items.slice(0,2).map(s=>`<span class="shift-pill ${types[s.type]?.cls||'shift-night'}">${escapeHtml(s.title||types[s.type]?.short||'Смена')}</span>`).join(''):'<span class="day-empty"></span>'}</button>`;
    }
    return `<div class="month-nav"><button id="prevMonth" aria-label="Предыдущий месяц">‹</button><strong>${monthTitle()} ${view.getFullYear()}</strong><button id="nextMonth" aria-label="Следующий месяц">›</button></div><div class="weekdays">${weekdays.map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-grid">${cells}</div><div class="calendar-legend">${Object.entries(types).map(([k,t])=>`<span class="legend"><i style="background:${t.color}"></i>${t.label}</span>`).join('')}</div><button class="quick-add" id="quickAdd" aria-label="Добавить смену">＋</button>`;
  }
  function monthShifts(){const prefix=`${view.getFullYear()}-${String(view.getMonth()+1).padStart(2,'0')}-`;return Object.entries(data.shifts).filter(([k])=>k.startsWith(prefix)).flatMap(([k,v])=>v.map(s=>({...s,date:k})))}
  function reports(){
    const rows=monthShifts(), work=rows.filter(x=>x.type==='night'||x.type==='work'), hours=work.reduce((a,x)=>a+Number(x.hours||0),0), sick=rows.filter(x=>x.type==='sick').length, off=rows.filter(x=>x.type==='off').length, income=hours*Number(data.rate||0);
    const byType=Object.keys(types).map(k=>({key:k,count:rows.filter(x=>x.type===k).length})).filter(x=>x.count);
    return `<h2 class="section-title">Отчёты</h2><div class="month-nav"><button id="prevMonth">‹</button><strong>1–${new Date(view.getFullYear(),view.getMonth()+1,0).getDate()} ${monthTitle()} ${view.getFullYear()}</strong><button id="nextMonth">›</button></div><div class="card"><h3 class="card-title">Итоги за месяц</h3><div class="metric-row"><span>Отработано часов</span><strong>${hours} ч</strong></div><div class="metric-row"><span>Количество смен</span><strong>${work.length}</strong></div><div class="metric-row"><span>Выходные</span><strong>${off}</strong></div><div class="metric-row"><span>Больничные</span><strong>${sick}</strong></div></div><div class="metric-grid"><div class="metric-tile"><span>Расчётный доход</span><strong>${money(income)}</strong></div><div class="metric-tile"><span>Ставка за час</span><strong>${money(Number(data.rate||0))}</strong></div></div><div class="card" style="margin-top:15px"><h3 class="card-title">Типы дней</h3>${byType.length?byType.map(x=>`<div class="metric-row"><span>${types[x.key].label}</span><strong>${x.count}</strong></div>`).join(''):'<div class="empty-state">Добавь смены в календарь — здесь появится статистика</div>'}</div><button class="secondary-btn" id="rateBtn" style="width:100%">Настроить почасовую ставку</button>`;
  }
  function templates(){return `<h2 class="section-title">Мои шаблоны</h2><div class="card">${Object.entries(types).map(([k,t])=>`<div class="template-row"><span class="template-icon" style="background:${t.color};color:white">${t.icon}</span><div class="template-copy"><strong>${t.label}</strong><small>${k==='night'?'19:00 – 09:00 · 14 ч':'Весь день'}</small></div><span class="chevron">›</span></div>`).join('')}</div><h2 class="section-title">Быстрое заполнение</h2><div class="card"><p class="muted" style="font-size:12px;line-height:1.5">Создай график повторяющихся смен — например, 2 через 2 или сутки через трое.</p><div class="field"><label>Рабочих дней подряд</label><input id="workDays" type="number" min="1" max="30" value="2"></div><div class="field"><label>Дней отдыха подряд</label><input id="restDays" type="number" min="1" max="30" value="2"></div><div class="field"><label>Начать с даты</label><input id="patternStart" type="date" value="${selected}"></div><div class="field"><label>Тип рабочей смены</label><select id="patternType"><option value="night">Ночная смена · 14 ч</option><option value="work">Отработано · 8 ч</option></select></div><button class="primary-btn" id="applyPattern" style="width:100%">Заполнить текущий месяц</button></div>`}
  function settings(){return `<h2 class="section-title">Настройки</h2><div class="card"><div class="settings-row"><span>Название приложения</span><strong>My help</strong></div><div class="settings-row"><span>Тема оформления</span><strong>Тёмная</strong></div><div class="settings-row"><span>Ставка за час</span><strong>${money(Number(data.rate||0))}</strong></div><div class="settings-row"><span>Хранение данных</span><strong>На этом iPhone</strong></div></div><div class="card"><h3 class="card-title">Данные</h3><p class="muted" style="font-size:12px;line-height:1.5">В первой версии график сохраняется локально на устройстве. Облачная синхронизация и резервное копирование будут добавлены отдельным этапом.</p><div class="action-row"><button class="secondary-btn" id="exportData">Экспорт JSON</button><button class="secondary-btn" id="importData">Импорт JSON</button></div><input id="importFile" type="file" accept="application/json" hidden></div><p class="muted" style="text-align:center;font-size:11px;padding:18px">My help · Версия 0.1.0</p>`}
  function openSheet(title,html){$('#sheetTitle').textContent=title;$('#sheetContent').innerHTML=html;$('#sheetBackdrop').classList.remove('hidden')}
  function closeSheet(){$('#sheetBackdrop').classList.add('hidden')}
  function addForm(date){selected=date;selectedType='night';const existing=shiftFor(date);openSheet('Смена на '+parse(date).toLocaleDateString('ru-RU',{day:'numeric',month:'long'}),`<div class="field"><label>Тип дня</label><div class="type-options">${Object.entries(types).map(([k,t])=>`<button class="type-option ${k===selectedType?'selected':''}" data-type="${k}"><i class="type-dot" style="background:${t.color}"></i>${t.label}</button>`).join('')}</div></div><div class="field"><label>Название (необязательно)</label><input id="shiftTitle" placeholder="Например, Ночная смена"></div><div class="field"><label>Начало</label><input id="shiftStart" type="time" value="19:00"></div><div class="field"><label>Окончание</label><input id="shiftEnd" type="time" value="09:00"></div><div class="field"><label>Часы для отчёта</label><input id="shiftHours" type="number" min="0" max="24" value="14"></div><div class="action-row"><button class="secondary-btn" id="cancelSheet">Отмена</button><button class="primary-btn" id="saveShift">Сохранить</button></div>`);$('#sheetContent').dataset.date=date; }
  function money(v){return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(v)+' ₽'}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function applyPattern(){const work=Math.max(1,Math.min(30,Number($('#workDays').value)||2)),rest=Math.max(1,Math.min(30,Number($('#restDays').value)||2)),start=parse($('#patternStart').value||selected),type=$('#patternType').value;let day=new Date(start),cycle=work+rest,month=view.getMonth(),year=view.getFullYear();for(let i=0;i<62;i++){if(day.getMonth()!==month||day.getFullYear()!==year){day.setDate(day.getDate()+1);continue}const pos=Math.floor((day-start)/86400000)%cycle;if(pos<work){data.shifts[key(day)]=[{type,title:types[type].short,hours:type==='night'?14:8,start:type==='night'?'19:00':'09:00',end:type==='night'?'09:00':'17:00'}]}else{data.shifts[key(day)]=[{type:'off',title:'Выходной',hours:0}]};day.setDate(day.getDate()+1)}save();tab='calendar';render();notify('График добавлен в календарь')}
  $('#screen').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.day){selected=b.dataset.day;view=new Date(parse(selected).getFullYear(),parse(selected).getMonth(),1);addForm(selected);return}
    if(b.id==='prevMonth'){view=new Date(view.getFullYear(),view.getMonth()-1,1);render()}
    if(b.id==='nextMonth'){view=new Date(view.getFullYear(),view.getMonth()+1,1);render()}
    if(b.id==='quickAdd')addForm(selected);
    if(b.id==='rateBtn')openSheet('Почасовая ставка',`<div class="field"><label>Ставка за один час, ₽</label><input id="rateInput" type="number" min="0" value="${Number(data.rate||0)}"></div><button class="primary-btn" id="saveRate" style="width:100%">Сохранить ставку</button>`);
    if(b.id==='applyPattern')applyPattern();
    if(b.id==='exportData'){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='my-help-backup.json';a.click();URL.revokeObjectURL(url)}
    if(b.id==='importData')$('#importFile').click();
  });
  $('#sheetContent').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.type){selectedType=b.dataset.type;$('#sheetContent').querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('selected',x.dataset.type===selectedType));return}
    if(b.id==='cancelSheet')closeSheet();
    if(b.id==='saveShift'){const date=$('#sheetContent').dataset.date,type=selectedType,title=$('#shiftTitle').value.trim()||types[type].short,start=$('#shiftStart').value,end=$('#shiftEnd').value,hours=Number($('#shiftHours').value||0);data.shifts[date]=[{type,title,start,end,hours}];save();closeSheet();render();notify('Смена сохранена')}
    if(b.id==='saveRate'){data.rate=Math.max(0,Number($('#rateInput').value)||0);save();closeSheet();render();notify('Ставка обновлена')}
  });
  $('#closeSheet').addEventListener('click',closeSheet);$('#sheetBackdrop').addEventListener('click',e=>{if(e.target.id==='sheetBackdrop')closeSheet()});
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render()}));
  $('#todayBtn').addEventListener('click',()=>{view=new Date(today.getFullYear(),today.getMonth(),1);selected=key(today);tab='calendar';render()});
  $('#importFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!parsed||typeof parsed.shifts!=='object')throw Error();data=parsed;save();render();notify('Резервная копия восстановлена')}catch{notify('Не удалось прочитать файл резервной копии')}e.target.value=''});
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  render();
})();