import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Bike, Boxes, CalendarDays, Check, ChevronRight, CircleDollarSign, Clock3, MapPin, Package, Plus, Search, Settings2, ShieldCheck, Star, Truck, Users, Wallet, X } from 'lucide-react'

type Role = 'dispatcher' | 'courier' | 'client' | 'admin'
type Status = 'Новый' | 'Назначен' | 'Забран' | 'В пути' | 'Доставлен'
type Order = { id: string; customer: string; address: string; from: string; price: number; status: Status; courier: string; time: string }
const initialOrders: Order[] = [
  { id: 'CF-1048', customer: 'Анна Смирнова', address: 'ул. Ленина, 12', from: 'пр-т Мира, 8', price: 450, status: 'В пути', courier: 'Алексей К.', time: '12:40' },
  { id: 'CF-1047', customer: 'Иван Петров', address: 'Невский пр-т, 24', from: 'ул. Садовая, 3', price: 390, status: 'Назначен', courier: 'Мария С.', time: '12:25' },
  { id: 'CF-1046', customer: 'Елена Волкова', address: 'ул. Гагарина, 6', from: 'ТЦ Центральный', price: 520, status: 'Новый', courier: 'Не назначен', time: '12:10' },
  { id: 'CF-1045', customer: 'Дмитрий Орлов', address: 'ул. Парковая, 19', from: 'ул. Лесная, 11', price: 350, status: 'Доставлен', courier: 'Алексей К.', time: '11:55' },
]
const money = (n: number) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽'
const nextStatus: Record<Status, Status> = { 'Новый': 'Назначен', 'Назначен': 'Забран', 'Забран': 'В пути', 'В пути': 'Доставлен', 'Доставлен': 'Доставлен' }

export default function App() {
  const [role, setRole] = useState<Role>('dispatcher')
  const [tab, setTab] = useState('overview')
  const [orders, setOrders] = useState(initialOrders)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newCustomer, setNewCustomer] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [notice, setNotice] = useState('')
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user
  const userName = tgUser?.first_name || 'Диспетчер'
  const filtered = useMemo(() => orders.filter(o => [o.id, o.customer, o.address, o.courier].join(' ').toLowerCase().includes(search.toLowerCase())), [orders, search])
  const active = orders.filter(o => o.status !== 'Доставлен').length
  const delivered = orders.filter(o => o.status === 'Доставлен').length
  const updateOrder = (id: string) => setOrders(old => old.map(o => o.id === id ? { ...o, status: nextStatus[o.status] } : o))
  const addOrder = () => {
    if (!newCustomer.trim() || !newAddress.trim()) return
    setOrders(old => [{ id: 'CF-' + (1049 + old.length - initialOrders.length), customer: newCustomer.trim(), address: newAddress.trim(), from: 'Точка отправления не указана', price: 400, status: 'Новый', courier: 'Не назначен', time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }, ...old])
    setNewCustomer(''); setNewAddress(''); setShowCreate(false); setNotice('Заказ добавлен в демонстрационный список')
    window.setTimeout(() => setNotice(''), 2800)
  }
  const nav = role === 'courier'
    ? [{ id: 'overview', label: 'Главная', icon: Truck }, { id: 'orders', label: 'Заказы', icon: Package }, { id: 'map', label: 'Карта', icon: MapPin }, { id: 'earnings', label: 'Доход', icon: Wallet }, { id: 'schedule', label: 'Смены', icon: CalendarDays }]
    : role === 'client'
      ? [{ id: 'overview', label: 'Главная', icon: Boxes }, { id: 'orders', label: 'Мои заказы', icon: Package }, { id: 'map', label: 'Отслеживание', icon: MapPin }]
      : [{ id: 'overview', label: 'Обзор', icon: Boxes }, { id: 'orders', label: 'Заказы', icon: Package }, { id: 'couriers', label: 'Курьеры', icon: Bike }, { id: 'map', label: 'Карта', icon: MapPin }, { id: 'finance', label: 'Финансы', icon: Wallet }]
  const heading = nav.find(n => n.id === tab)?.label || 'Обзор'

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Truck size={21}/></div><div><b>CourierFlow</b><small>DELIVERY CONTROL</small></div></div>
      <div className="workspace"><span className="online-dot"/> Служба доставки <ChevronRight size={15}/></div>
      <div className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav>{nav.map(item => <button key={item.id} className={tab === item.id ? 'nav-item selected' : 'nav-item'} onClick={() => setTab(item.id)}><item.icon size={18}/>{item.label}{item.id === 'orders' && <span className="nav-count">{active}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="avatar">{userName.slice(0,1).toUpperCase()}</div><div className="profile-copy"><b>{userName}</b><small>{roleLabel(role)}</small></div><Settings2 size={17} className="muted"/></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">CourierFlow <ChevronRight size={14}/><b>{heading}</b></div><div className="top-actions"><span className="live-pill"><span className="online-dot"/> Система активна</span><div className="avatar small">{userName.slice(0,1).toUpperCase()}</div></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</div><h1>{tab === 'overview' ? 'Добрый день, ' + userName : heading}</h1><p>{tab === 'overview' ? 'Вот что происходит в службе доставки сегодня.' : 'Управляйте доставкой и следите за обновлениями в реальном времени.'}</p></div><button className="primary-btn" onClick={() => setShowCreate(true)}><Plus size={17}/> Новый заказ</button></div>

        <div className="role-switch"><ShieldCheck size={16}/><span>Режим просмотра:</span>{(['dispatcher','courier','client','admin'] as Role[]).map(r => <button key={r} className={role === r ? 'role active' : 'role'} onClick={() => {setRole(r); setTab('overview')}}>{roleLabel(r)}</button>)}</div>

        {tab === 'overview' && <><section className="stats-grid">
          <Stat icon={<Package/>} label="Всего заказов" value={String(orders.length)} note="+12% к прошлой неделе" tone="blue"/>
          <Stat icon={<Clock3/>} label="Активные доставки" value={String(active)} note="Требуют внимания" tone="amber"/>
          <Stat icon={<Check/>} label="Доставлено сегодня" value={String(delivered)} note="Все успешно" tone="green"/>
          <Stat icon={<CircleDollarSign/>} label="Оборот сегодня" value={money(orders.reduce((s,o)=>s+o.price,0))} note="Демонстрационные данные" tone="violet"/>
        </section><div className="section-title"><div><h2>Последние заказы</h2><p>Текущая ситуация по доставкам</p></div><button className="text-btn" onClick={() => setTab('orders')}>Все заказы <ChevronRight size={15}/></button></div><OrderTable orders={filtered.slice(0,4)} updateOrder={updateOrder} role={role}/></>}

        {tab === 'orders' && <><div className="toolbar"><div className="search-box"><Search size={17}/><input placeholder="Поиск по заказу, клиенту или адресу" value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="result-count">{filtered.length} заказов</span></div><OrderTable orders={filtered} updateOrder={updateOrder} role={role}/></>}
        {tab === 'map' && <div className="map-panel"><div className="map-placeholder"><div className="map-grid"/><div className="map-pin pin-one"><MapPin/></div><div className="map-pin pin-two"><MapPin/></div><div className="map-pin pin-three"><Bike/></div><div className="map-label label-one">Точка отправления</div><div className="map-label label-two">Курьер на маршруте</div><div className="map-center"><MapPin size={18}/> Карта подключается на следующем этапе</div></div><div className="map-legend"><span><i className="legend-dot blue"/> Заказы</span><span><i className="legend-dot green"/> Курьеры</span><span className="muted">Для GPS потребуется разрешение пользователя и ключ картографического сервиса.</span></div></div>}
        {tab === 'couriers' && <div className="courier-grid"><Courier name="Алексей К." status="На доставке" count="4 заказа" rating="4.9"/><Courier name="Мария С." status="На линии" count="2 заказа" rating="5.0"/><Courier name="Илья П." status="Не на линии" count="—" rating="4.8"/></div>}
        {tab === 'earnings' || tab === 'finance' ? <section className="stats-grid"><Stat icon={<Wallet/>} label="Заработано сегодня" value={money(orders.filter(o=>o.status==='Доставлен').reduce((s,o)=>s+o.price,0)*.7)} note="Расчёт-пример" tone="green"/><Stat icon={<CircleDollarSign/>} label="Ожидает выплаты" value={money(0)} note="Нет подтверждённых выплат" tone="violet"/></section> : null}
        {tab === 'schedule' && <div className="empty-panel"><CalendarDays size={30}/><h3>График смен</h3><p>Здесь появятся ваши смены и возможность выйти на линию после подключения базы данных.</p></div>}
        {tab === 'clients' && <div className="empty-panel"><Users size={30}/><h3>Клиенты</h3><p>Профили клиентов и история заказов будут доступны после подключения серверной части.</p></div>}
      </div>
    </main>
    {notice && <div className="toast"><Check size={16}/>{notice}</div>}
    {showCreate && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false)}}><div className="modal"><div className="modal-head"><div><h2>Новый заказ</h2><p>Быстрое создание доставки</p></div><button className="icon-btn" onClick={()=>setShowCreate(false)}><X/></button></div><label>Имя клиента<input value={newCustomer} onChange={e=>setNewCustomer(e.target.value)} placeholder="Например, Анна Смирнова"/></label><label>Адрес доставки<input value={newAddress} onChange={e=>setNewAddress(e.target.value)} placeholder="Улица, дом, квартира"/></label><button className="primary-btn full" onClick={addOrder} disabled={!newCustomer.trim()||!newAddress.trim()}>Создать заказ <ChevronRight size={17}/></button></div></div>}
    <div className="mobile-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'mobile-active':''} onClick={()=>setTab(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}</div>
  </div>
}
function roleLabel(role: Role) { return ({ dispatcher: 'Диспетчер', courier: 'Курьер', client: 'Клиент', admin: 'Администратор' })[role] }
function Stat({icon,label,value,note,tone}:{icon:ReactNode;label:string;value:string;note:string;tone:string}) { return <div className="stat-card"><div className={'stat-icon '+tone}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div> }
function OrderTable({orders,updateOrder,role}:{orders:Order[];updateOrder:(id:string)=>void;role:Role}) { return <div className="table-wrap"><table><thead><tr><th>ЗАКАЗ</th><th>КЛИЕНТ</th><th>АДРЕС ДОСТАВКИ</th><th>КУРЬЕР</th><th>СТАТУС</th><th>СУММА</th><th/></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><b className="order-id">{o.id}</b><small className="cell-sub">{o.time}</small></td><td>{o.customer}</td><td><span className="address"><MapPin size={13}/>{o.address}</span></td><td>{o.courier}</td><td><span className={'status status-'+statusClass(o.status)}>{o.status}</span></td><td><b>{money(o.price)}</b></td><td><button className="advance-btn" onClick={()=>updateOrder(o.id)} disabled={o.status==='Доставлен'||role==='client'} title="Изменить статус"><ChevronRight size={16}/></button></td></tr>)}</tbody></table>{orders.length===0&&<div className="empty-table">Заказы не найдены</div>}</div> }
function statusClass(s:Status) { return ({'Новый':'new','Назначен':'assigned','Забран':'picked','В пути':'route','Доставлен':'done'})[s] }
function Courier({name,status,count,rating}:{name:string;status:string;count:string;rating:string}) { return <div className="courier-card"><div className="courier-avatar"><Bike/></div><div className="courier-info"><b>{name}</b><span>{status}</span><small>{count}</small></div><div className="rating"><Star size={14} fill="currentColor"/>{rating}</div></div> }