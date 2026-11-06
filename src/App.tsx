import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { supabase } from './lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import { Bike, CalendarDays, Check, ChevronRight, CircleDollarSign, Clock3, LogOut, MapPin, Package, Plus, RefreshCw, Search, Truck, Users, Wallet, X } from 'lucide-react'

type Role = 'admin' | 'dispatcher' | 'courier' | 'client'
type OrderStatus = 'new' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
type Profile = { id: string; full_name: string; phone: string | null; role: Role; rating: number; is_active: boolean }
type Order = {
  id: string; order_number: number; customer_id: string; courier_id: string | null
  pickup_address: string; delivery_address: string; customer_note: string | null
  price: number; status: OrderStatus; scheduled_for: string | null; created_at: string
  accepted_at: string | null; picked_up_at: string | null; delivered_at: string | null
}
type Shift = { id: string; starts_at: string; ends_at: string | null; status: string }
type CourierOption = { id: string; full_name: string; phone: string | null }

const roleNames: Record<Role, string> = { admin: 'Администратор', dispatcher: 'Диспетчер', courier: 'Курьер', client: 'Клиент' }
const statusNames: Record<OrderStatus, string> = { new: 'Новый', assigned: 'Назначен', picked_up: 'Забран', in_transit: 'В пути', delivered: 'Доставлен', cancelled: 'Отменён' }
const money = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽'
const time = (value: string) => new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [couriers, setCouriers] = useState<CourierOption[]>([])
  const [tab, setTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [pickup, setPickup] = useState('')
  const [delivery, setDelivery] = useState('')
  const [price, setPrice] = useState('0')
  const [note, setNote] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const tg = window.Telegram?.WebApp

  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  const loadData = useCallback(async (user: User, quiet = false) => {
    if (!quiet) setRefreshing(true)
    const [p, o, s] = await Promise.all([
      supabase.from('profiles').select('id,full_name,phone,role,rating,is_active').eq('id', user.id).maybeSingle(),
      supabase.from('delivery_orders').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('courier_shifts').select('id,starts_at,ends_at,status').order('starts_at', { ascending: false }).limit(30),
    ])
    if (p.error) notify('Профиль: ' + p.error.message)
    if (p.data) {
      setProfile(p.data as Profile)
      if (p.data.role === 'admin' || p.data.role === 'dispatcher') {
        const c = await supabase.from('profiles').select('id,full_name,phone').eq('role','courier').eq('is_active',true).order('full_name')
        if (!c.error) setCouriers((c.data || []) as CourierOption[])
      } else setCouriers([])
    } else if (!p.error) notify('Профиль ещё создаётся. Обнови экран через пару секунд.')
    if (o.error) notify('Заказы: ' + o.error.message)
    else setOrders((o.data || []) as Order[])
    if (!s.error) setShifts((s.data || []) as Shift[])
    setRefreshing(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    tg?.ready()
    tg?.expand()
    tg?.setHeaderColor?.('#0b1020')
    tg?.setBackgroundColor?.('#0b1020')
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      if (data.session) {
        setSession(data.session)
        await loadData(data.session.user, true)
        return
      }
      const initData = tg?.initData
      if (initData) {
        setAuthMessage('Проверяем Telegram...')
        const { data: authData, error } = await supabase.functions.invoke('telegram-auth', { body: { initData } })
        if (!error && authData?.token_hash) {
          const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: authData.token_hash, type: 'magiclink' })
          if (!verifyError && verified.session) {
            setSession(verified.session)
            await loadData(verified.session.user, true)
            return
          }
          setAuthMessage(verifyError?.message || 'Не удалось завершить вход через Telegram.')
        } else {
          setAuthMessage(error?.message || authData?.error || 'Telegram-вход пока не настроен. Используй вход по почте.')
        }
      }
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) {
        window.setTimeout(() => { if (mounted) void loadData(next.user, true) }, 0)
      } else {
        setProfile(null); setOrders([]); setShifts([]); setCouriers([])
      }
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [loadData, tg])

  useEffect(() => {
    if (!session) return
    const channel = supabase.channel('courierflow-live-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders' }, () => { void loadData(session.user, true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_shifts' }, () => { void loadData(session.user, true) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [session, loadData])

  const role = profile?.role || 'client'
  const isStaff = role === 'admin' || role === 'dispatcher'
  const filtered = useMemo(() => orders.filter(o => {
    const q = search.trim().toLowerCase()
    return !q || [String(o.order_number), o.pickup_address, o.delivery_address, o.customer_note || ''].join(' ').toLowerCase().includes(q)
  }), [orders, search])
  const active = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length
  const deliveredToday = orders.filter(o => o.status === 'delivered' && new Date(o.delivered_at || o.created_at).toDateString() === new Date().toDateString()).length
  const revenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.price || 0), 0)
  const myEarnings = orders.filter(o => o.courier_id === session?.user.id && o.status === 'delivered').reduce((sum, o) => sum + Number(o.price || 0) * 0.7, 0)

  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setAuthBusy(true); setAuthMessage('')
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (result.error) setAuthMessage(result.error.message)
    else if (authMode === 'signup' && !result.data.session) setAuthMessage('Аккаунт создан. Подтверди почту по ссылке из письма, затем войди.')
    else if (result.data.session) { setSession(result.data.session); await loadData(result.data.session.user, true) }
    setAuthBusy(false)
  }

  const createOrder = async (event: FormEvent) => {
    event.preventDefault()
    if (!session || !pickup.trim() || !delivery.trim()) return
    const amount = Number(price.replace(',', '.'))
    if (!Number.isFinite(amount) || amount < 0) { notify('Проверь стоимость заказа'); return }
    const { data, error } = await supabase.from('delivery_orders').insert({
      customer_id: session.user.id, pickup_address: pickup.trim(), delivery_address: delivery.trim(),
      customer_note: note.trim() || null, price: amount, status: 'new',
    }).select().single()
    if (error) { notify('Не удалось создать заказ: ' + error.message); return }
    setOrders(old => [data as Order, ...old]); setPickup(''); setDelivery(''); setPrice('0'); setNote(''); setShowCreate(false)
    notify('Заказ #' + data.order_number + ' сохранён в базе')
  }

  const changeStatus = async (order: Order) => {
    if (!session) return
    let patch: Record<string, unknown> = {}
    let next: OrderStatus
    if (role === 'courier') {
      if (!order.courier_id && order.status === 'new') {
        next = 'assigned'; patch = { courier_id: session.user.id, status: next, accepted_at: new Date().toISOString() }
      } else if (order.courier_id === session.user.id && order.status === 'assigned') {
        next = 'picked_up'; patch = { status: next, picked_up_at: new Date().toISOString() }
      } else if (order.courier_id === session.user.id && order.status === 'picked_up') {
        next = 'in_transit'; patch = { status: next }
      } else if (order.courier_id === session.user.id && order.status === 'in_transit') {
        next = 'delivered'; patch = { status: next, delivered_at: new Date().toISOString() }
      } else return
    } else {
      if (!isStaff) return
      const flow: Record<OrderStatus, OrderStatus> = { new: 'assigned', assigned: 'picked_up', picked_up: 'in_transit', in_transit: 'delivered', delivered: 'delivered', cancelled: 'cancelled' }
      next = flow[order.status]
      patch = { status: next }
    }
    const { data, error } = await supabase.from('delivery_orders').update(patch).eq('id', order.id).select().single()
    if (error) { notify('Не удалось обновить заказ: ' + error.message); return }
    setOrders(old => old.map(o => o.id === order.id ? data as Order : o))
    await supabase.from('order_events').insert({ order_id: order.id, actor_id: session.user.id, from_status: order.status, to_status: next })
    notify('Статус заказа изменён: ' + statusNames[next])
  }

  const assignCourier = async (order: Order, courierId: string) => {
    if (!isStaff || !courierId || !session || order.status !== 'new') return
    const { data, error } = await supabase.from('delivery_orders').update({
      courier_id: courierId, status: 'assigned', accepted_at: new Date().toISOString(),
    }).eq('id', order.id).select().single()
    if (error) { notify('Не удалось назначить курьера: ' + error.message); return }
    setOrders(old => old.map(o => o.id === order.id ? data as Order : o))
    await supabase.from('order_events').insert({ order_id: order.id, actor_id: session.user.id, from_status: 'new', to_status: 'assigned', note: 'Курьер назначен диспетчером' })
    notify('Курьер назначен на заказ #' + order.order_number)
  }

  const signOut = async () => { await supabase.auth.signOut(); setProfile(null); setSession(null); setTab('overview') }
  const tabs = role === 'courier'
    ? [{ id: 'overview', label: 'Главная', icon: Truck }, { id: 'orders', label: 'Заказы', icon: Package }, { id: 'map', label: 'Карта', icon: MapPin }, { id: 'earnings', label: 'Доход', icon: Wallet }, { id: 'schedule', label: 'Смены', icon: CalendarDays }]
    : role === 'client'
      ? [{ id: 'overview', label: 'Главная', icon: Package }, { id: 'orders', label: 'Мои заказы', icon: Package }]
      : [{ id: 'overview', label: 'Обзор', icon: Package }, { id: 'orders', label: 'Заказы', icon: Package }, { id: 'couriers', label: 'Курьеры', icon: Bike }, { id: 'clients', label: 'Клиенты', icon: Users }, { id: 'map', label: 'Карта', icon: MapPin }, { id: 'finance', label: 'Финансы', icon: Wallet }]
  const heading = tabs.find(t => t.id === tab)?.label || 'Обзор'

  if (loading) return <div className="auth-shell"><div className="auth-card"><div className="brand-mark"><Truck size={22}/></div><h1>CourierFlow</h1><p>Подключаем безопасную сессию и загружаем данные…</p><div className="loading-line"/></div></div>
  if (!session) return <div className="auth-shell"><form className="auth-card" onSubmit={signIn}>
    <div className="auth-brand"><div className="brand-mark"><Truck size={22}/></div><div><b>CourierFlow</b><small>DELIVERY CONTROL</small></div></div>
    <div className="eyebrow">КУРЬЕРСКАЯ ПЛАТФОРМА</div><h1>{authMode === 'signin' ? 'С возвращением' : 'Создать аккаунт'}</h1>
    <p>Войди, чтобы работать с реальными заказами и данными службы доставки.</p>
    {authMode === 'signup' && <label>Имя<input required value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Как к тебе обращаться"/></label>}
    <label>Электронная почта<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label>
    <label>Пароль<input required type="password" minLength={6} autoComplete={authMode==='signin'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Не менее 6 символов"/></label>
    {authMessage && <div className="auth-message">{authMessage}</div>}
    <button className="primary-btn full" disabled={authBusy}>{authBusy?'Подождите…':authMode==='signin'?'Войти':'Зарегистрироваться'}</button>
    <button type="button" className="text-btn auth-switch" onClick={()=>{setAuthMode(authMode==='signin'?'signup':'signin');setAuthMessage('')}}>{authMode==='signin'?'Нет аккаунта? Создать':'Уже есть аккаунт? Войти'}</button>
    {tg?.initData && <div className="auth-hint">Telegram открыт. Для входа без почты настрой серверный секрет TELEGRAM_BOT_TOKEN.</div>}
  </form></div>

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Truck size={21}/></div><div><b>CourierFlow</b><small>DELIVERY CONTROL</small></div></div>
      <div className="workspace"><span className="online-dot"/> Служба доставки <ChevronRight size={15}/></div>
      <div className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav>{tabs.map(item=><button key={item.id} className={tab===item.id?'nav-item selected':'nav-item'} onClick={()=>setTab(item.id)}><item.icon size={18}/>{item.label}{item.id==='orders'&&<span className="nav-count">{active}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="avatar">{(profile?.full_name || session.user.email || 'U').slice(0,1).toUpperCase()}</div><div className="profile-copy"><b>{profile?.full_name || session.user.email}</b><small>{roleNames[role]}</small></div><button className="icon-btn" onClick={signOut} title="Выйти"><LogOut size={16}/></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb">CourierFlow <ChevronRight size={14}/><b>{heading}</b></div><div className="top-actions"><span className="live-pill"><span className="online-dot"/> Supabase подключён</span><button className="icon-btn" disabled={refreshing} onClick={()=>void loadData(session.user)} title="Обновить"><RefreshCw size={15}/></button><div className="avatar small">{(profile?.full_name||'U').slice(0,1).toUpperCase()}</div></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">{roleNames[role].toUpperCase()}</div><h1>{tab==='overview'?'Добрый день, '+(profile?.full_name||'пользователь'):heading}</h1><p>Данные загружаются из базы CourierFlow и синхронизируются между устройствами.</p></div>{(role==='client'||isStaff)&&<button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={17}/> Новый заказ</button>}</div>
        <section className="stats-grid">
          <Stat icon={<Package/>} label="Всего доступных заказов" value={String(orders.length)} note="Данные Supabase" tone="blue"/>
          <Stat icon={<Clock3/>} label="Активные" value={String(active)} note="Не завершены" tone="amber"/>
          <Stat icon={<Check/>} label="Доставлено сегодня" value={String(deliveredToday)} note="Подтверждённые доставки" tone="green"/>
          <Stat icon={<CircleDollarSign/>} label={role==='courier'?'Мой доход':'Оборот доставок'} value={money(role==='courier'?myEarnings:revenue)} note="По сохранённым заказам" tone="violet"/>
        </section>
        {tab==='overview'&&<><div className="section-title"><div><h2>{role==='courier'?'Доступные и мои заказы':'Последние заказы'}</h2><p>Обновляется в реальном времени</p></div><button className="text-btn" onClick={()=>setTab('orders')}>Все заказы <ChevronRight size={15}/></button></div><OrderList orders={filtered.slice(0,5)} role={role} userId={session.user.id} couriers={couriers} onAdvance={changeStatus} onAssign={assignCourier}/></>}
        {tab==='orders'&&<><div className="toolbar"><div className="search-box"><Search size={17}/><input placeholder="Поиск по номеру или адресу" value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="result-count">{filtered.length} заказов</span></div><OrderList orders={filtered} role={role} userId={session.user.id} couriers={couriers} onAdvance={changeStatus} onAssign={assignCourier}/></>}
        {tab==='map'&&<div className="empty-panel"><MapPin size={30}/><h3>Карта и GPS</h3><p>Заказы уже хранятся в базе. Для живой карты нужно выбрать картографический сервис и регион доставки; GPS координаты подключим следующим этапом.</p></div>}
        {tab==='couriers'&&<div className="empty-panel"><Bike size={30}/><h3>Курьеры</h3><p>Профили курьеров и их активные заказы доступны через защищённые профили и назначения. Отдельный экран управления добавим следующим этапом.</p></div>}
        {tab==='clients'&&<div className="empty-panel"><Users size={30}/><h3>Клиенты</h3><p>Список клиентов будет показывать только профили, связанные с заказами пользователя или доступные сотрудникам.</p></div>}
        {tab==='finance'&&<div className="stats-grid"><Stat icon={<Wallet/>} label="Оборот доставок" value={money(revenue)} note="Доставленные заказы" tone="green"/><Stat icon={<Package/>} label="Заказов завершено" value={String(orders.filter(o=>o.status==='delivered').length)} note="Из загруженных записей" tone="blue"/></div>}
        {tab==='earnings'&&<div className="stats-grid"><Stat icon={<Wallet/>} label="Мой заработок" value={money(myEarnings)} note="70% от стоимости доставленных заказов" tone="green"/><Stat icon={<Package/>} label="Мои доставки" value={String(orders.filter(o=>o.courier_id===session.user.id&&o.status==='delivered').length)} note="Завершено" tone="blue"/></div>}
        {tab==='schedule'&&<div className="shift-list"><h2>Мои смены</h2>{shifts.length?shifts.map(s=><div className="shift-row" key={s.id}><CalendarDays size={18}/><div><b>{time(s.starts_at)}</b><small>{s.ends_at?time(s.ends_at):'Время окончания не задано'}</small></div><span className="status status-assigned">{s.status}</span></div>):<div className="empty-panel">Смен пока нет. Диспетчер сможет добавить их после настройки расписания.</div>}</div>}
      </div>
    </main>
    {notice&&<div className="toast"><Check size={16}/>{notice}</div>}
    {showCreate&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCreate(false)}}><form className="modal" onSubmit={createOrder}><div className="modal-head"><div><h2>Новый заказ</h2><p>Заказ сохранится в Supabase</p></div><button type="button" className="icon-btn" onClick={()=>setShowCreate(false)}><X/></button></div><label>Адрес отправления<input required value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="Откуда забрать"/></label><label>Адрес доставки<input required value={delivery} onChange={e=>setDelivery(e.target.value)} placeholder="Куда доставить"/></label><label>Стоимость, ₽<input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Комментарий<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Дополнительная информация"/></label><button className="primary-btn full">Создать заказ <ChevronRight size={17}/></button></form></div>}
    <div className="mobile-nav">{tabs.slice(0,5).map(item=><button key={item.id} className={tab===item.id?'mobile-active':''} onClick={()=>setTab(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}</div>
  </div>
}

function AssignControl({order,couriers,onAssign}:{order:Order;couriers:CourierOption[];onAssign:(order:Order,courierId:string)=>void}) {
  const [courierId,setCourierId]=useState('')
  return <div className="assign-control"><select value={courierId} onChange={e=>setCourierId(e.target.value)}><option value="">Выбери курьера</option>{couriers.map(c=><option key={c.id} value={c.id}>{c.full_name||c.phone||c.id.slice(0,8)}</option>)}</select><button className="advance-btn wide" disabled={!courierId} onClick={()=>onAssign(order,courierId)}>Назначить <ChevronRight size={14}/></button>{couriers.length===0&&<small>Нет активных курьеров с ролью «Курьер»</small>}</div>
}
function Stat({icon,label,value,note,tone}:{icon:ReactNode;label:string;value:string;note:string;tone:string}) { return <div className="stat-card"><div className={'stat-icon '+tone}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div> }
function OrderList({orders,role,userId,couriers,onAdvance,onAssign}:{orders:Order[];role:Role;userId:string;couriers:CourierOption[];onAdvance:(order:Order)=>void;onAssign:(order:Order,courierId:string)=>void}) {
  if (!orders.length) return <div className="empty-panel"><Package size={28}/><h3>Заказов пока нет</h3><p>Создай первый заказ или обнови страницу, когда диспетчер назначит доставку.</p></div>
  return <div className="live-order-list">{orders.map(o=>{
    const canClaim=role==='courier'&&o.status==='new'&&!o.courier_id
    const mine=o.courier_id===userId
    const canAdvance=role==='courier'?(canClaim||mine&&['assigned','picked_up','in_transit'].includes(o.status)):(role==='admin'||role==='dispatcher')&&['assigned','picked_up','in_transit'].includes(o.status)
    const next=canClaim?'Принять заказ':o.status==='assigned'?'Забрал заказ':o.status==='picked_up'?'Выехал':o.status==='in_transit'?'Завершить':o.status==='new'?'Назначить':''
    return <article className="live-order-card" key={o.id}><div className="live-order-top"><b>Заказ #{o.order_number}</b><span className={'status status-'+o.status}>{statusNames[o.status]}</span></div><div className="order-route"><div><i className="route-dot from"/><span><small>ОТКУДА</small><b>{o.pickup_address}</b></span></div><div><i className="route-dot to"/><span><small>КУДА</small><b>{o.delivery_address}</b></span></div></div>{o.customer_note&&<p className="order-note">{o.customer_note}</p>}{(role==='admin'||role==='dispatcher')&&o.status==='new'&&<AssignControl order={o} couriers={couriers} onAssign={onAssign}/>}<div className="live-order-bottom"><span>{time(o.created_at)}</span><b>{money(Number(o.price))}</b>{canAdvance&&<button className="advance-btn wide" onClick={()=>onAdvance(o)}>{next}<ChevronRight size={15}/></button>}</div></article>
  })}</div>
}
