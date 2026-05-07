import React, { useState, useEffect } from 'react';
import {
  Send, LayoutGrid, PlusCircle, ArrowLeft, CheckCircle2,
  Circle, X, ChevronRight, AlertCircle, Calendar as CalendarIcon,
  ChevronLeft, Settings as SettingsIcon, Save, Search, Trash2, Archive
} from 'lucide-react';

const PASTEL = {
  red:    { bg: '#FFD6D6', text: '#c0392b', dot: '#e74c3c' },
  purple: { bg: '#D6D0FF', text: '#5b2fc7', dot: '#7c5cbf' },
  yellow: { bg: '#FFF3C4', text: '#b07d00', dot: '#f1c40f' },
  green:  { bg: '#C8F0D8', text: '#1a7a45', dot: '#2ecc71' },
};

const App = () => {
  const [tasks, setTasks] = useState(() => {
    const s = localStorage.getItem('agent_tasks');
    return s ? JSON.parse(s) : [];
  });
  const [userName, setUserName] = useState(() => localStorage.getItem('agent_user_name') || 'Студент');
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('agent_api_key') || '');
  const [view, setView] = useState('home');
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState('');

  useEffect(() => { localStorage.setItem('agent_tasks', JSON.stringify(tasks)); }, [tasks]);

  const saveSettings = (name, key) => {
    localStorage.setItem('agent_user_name', name);
    localStorage.setItem('agent_api_key', key);
    setUserName(name); setUserApiKey(key); setView('home');
  };

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const closeDetail = () => setActiveTaskId(null);

  const callGemini = async (prompt) => {
    if (!userApiKey) throw new Error('Вставь API-ключ в настройки!');
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: `Ты — AI-агент для студента ${userName}. Возвращай дату в формате YYYY-MM-DD. Используй yellow для важных, purple для средних, green для простых, red только для срочных.` }] },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            isDeadlineMissing: { type: 'BOOLEAN' },
            title: { type: 'STRING' },
            deadline: { type: 'STRING' },
            priorityColor: { type: 'STRING', enum: ['red', 'purple', 'yellow', 'green'] },
            reasoning: { type: 'STRING' },
            steps: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, completed: { type: 'BOOLEAN' } } } }
          }
        }
      }
    };
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('API не отвечает. Проверь ключ.');
    const result = await res.json();
    return JSON.parse(result.candidates[0].content.parts[0].text);
  };

  const handleAddTask = async (e) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;
    setIsProcessing(true); setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const prompt = pendingTask
        ? `Сегодня ${today}. Уточнение дедлайна для "${pendingTask.rawInput}": "${inputValue}". Выдай JSON.`
        : `Сегодня ${today}. Разбери задачу: "${inputValue}". Если даты нет, установи isDeadlineMissing: true.`;
      const ai = await callGemini(prompt);
      if (ai.isDeadlineMissing && !pendingTask) {
        setPendingTask({ rawInput: inputValue }); setInputValue(''); setIsProcessing(false); return;
      }
      setTasks(prev => [...prev, {
        id: Date.now(),
        title: ai.title || inputValue,
        deadline: ai.deadline || today,
        color: ai.priorityColor || 'green',
        steps: ai.steps || [],
        reasoning: ai.reasoning || '',
        createdAt: new Date().toLocaleDateString()
      }]);
      setInputValue(''); setPendingTask(null); setView('board');
    } catch (err) { setError(err.message); }
    finally { setIsProcessing(false); }
  };

  const toggleStep = (taskId, idx) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const steps = [...t.steps];
      steps[idx] = { ...steps[idx], completed: !steps[idx].completed };
      return { ...t, steps };
    }));
  };

  const deleteTask = (id) => { setTasks(prev => prev.filter(t => t.id !== id)); closeDetail(); };

  // Calendar
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));

  const navItems = [
    { id: 'home',     label: 'Новая задача', icon: <PlusCircle size={18}/> },
    { id: 'board',    label: 'Доска',        icon: <LayoutGrid size={18}/> },
    { id: 'calendar', label: 'Календарь',    icon: <CalendarIcon size={18}/> },
    { id: 'settings', label: 'Настройки',    icon: <SettingsIcon size={18}/> },
  ];

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F7', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width:220, background:'#fff', borderRight:'1px solid #EBEBEB', padding:'32px 0', display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
        {/* Logo */}
        <div style={{ padding:'0 24px 28px', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'#5C6BC0', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <LayoutGrid size={16} color="#fff"/>
          </div>
          <span style={{ fontWeight:800, fontSize:15, letterSpacing:1, color:'#222' }}>TASK.AI</span>
        </div>

        {navItems.map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{
            display:'flex', alignItems:'center', gap:12, padding:'10px 24px',
            background: view===n.id ? '#F0F1FF' : 'transparent',
            color: view===n.id ? '#5C6BC0' : '#888',
            border:'none', cursor:'pointer', fontSize:14, fontWeight: view===n.id ? 700 : 500,
            borderLeft: view===n.id ? '3px solid #5C6BC0' : '3px solid transparent',
            transition:'all .15s'
          }}>
            {n.icon} {n.label}
          </button>
        ))}

        <div style={{ marginTop:'auto', padding:'0 24px' }}>
          <button onClick={() => setView('settings')} style={{
            width:'100%', padding:'12px', borderRadius:12, background:'#5C6BC0',
            color:'#fff', border:'none', fontWeight:700, fontSize:13, cursor:'pointer'
          }}>
            {userApiKey ? '✓ Ключ активен' : '+ Добавить ключ'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <header style={{ background:'#fff', borderBottom:'1px solid #EBEBEB', padding:'18px 32px', display:'flex', alignItems:'center', gap:16 }}>
          <h1 style={{ flex:1, margin:0, fontSize:22, fontWeight:800, color:'#1a1a2e', letterSpacing:.5 }}>
            {view==='home' ? 'Новая задача' : view==='board' ? 'Мои задачи' : view==='calendar' ? 'Календарь' : 'Настройки'}
          </h1>

          {/* Search */}
          {view==='board' && (
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <Search size={15} style={{ position:'absolute', left:12, color:'#aaa' }}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск..."
                style={{ paddingLeft:36, paddingRight:16, paddingTop:9, paddingBottom:9, border:'1.5px solid #EBEBEB', borderRadius:12, fontSize:13, outline:'none', background:'#F8F8FC', width:220 }}/>
            </div>
          )}

          <div style={{ width:36, height:36, borderRadius:50, background:'#5C6BC0', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14 }}>
            {userName[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize:14, fontWeight:600, color:'#444' }}>{userName}</span>
        </header>

        <main style={{ padding:32, flex:1, overflowY:'auto' }}>

          {/* HOME */}
          {view==='home' && (
            <div style={{ maxWidth:600, margin:'40px auto' }}>
              <div style={{ background:'#fff', borderRadius:24, padding:40, boxShadow:'0 4px 24px rgba(0,0,0,0.06)' }}>
                <h2 style={{ margin:'0 0 8px', fontSize:24, fontWeight:800, color:'#1a1a2e' }}>
                  {pendingTask ? '📅 Укажи дедлайн' : `Привет, ${userName}!`}
                </h2>
                <p style={{ margin:'0 0 28px', color:'#999', fontSize:14 }}>
                  {!userApiKey ? 'Сначала добавь API-ключ в Настройках.' : pendingTask ? `Когда сдавать "${pendingTask.rawInput}"?` : 'Опиши задачу — AI всё разберёт.'}
                </p>
                <form onSubmit={handleAddTask} style={{ display:'flex', gap:12 }}>
                  <input autoFocus value={inputValue} onChange={e=>setInputValue(e.target.value)}
                    placeholder={pendingTask ? 'Напр: 25 мая, через неделю...' : 'Напр: Сдать курсовую...'}
                    disabled={isProcessing || !userApiKey}
                    style={{ flex:1, padding:'14px 18px', border:'2px solid #EBEBEB', borderRadius:14, fontSize:15, outline:'none', fontFamily:'inherit', background: !userApiKey?'#fafafa':'#fff', transition:'border .2s' }}
                    onFocus={e=>e.target.style.borderColor='#5C6BC0'} onBlur={e=>e.target.style.borderColor='#EBEBEB'}
                  />
                  <button type="submit" disabled={isProcessing||!inputValue.trim()||!userApiKey}
                    style={{ padding:'14px 22px', background:'#5C6BC0', color:'#fff', border:'none', borderRadius:14, fontWeight:700, fontSize:14, cursor:'pointer', opacity: (isProcessing||!inputValue.trim()||!userApiKey)?0.5:1, transition:'opacity .2s' }}>
                    {isProcessing ? '...' : <Send size={18}/>}
                  </button>
                </form>
                {error && (
                  <div style={{ marginTop:16, padding:'12px 16px', background:'#FFF0F0', border:'1px solid #FFD6D6', borderRadius:12, color:'#c0392b', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
                    <AlertCircle size={16}/> {error}
                  </div>
                )}
              </div>

              {/* Recent tasks preview */}
              {tasks.length > 0 && (
                <div style={{ marginTop:32 }}>
                  <h3 style={{ fontSize:16, fontWeight:700, color:'#1a1a2e', marginBottom:16 }}>Последние задачи</h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
                    {tasks.slice(-4).map(t => (
                      <div key={t.id} onClick={()=>{setActiveTaskId(t.id);setView('board');}}
                        style={{ background: PASTEL[t.color]?.bg||'#eee', borderRadius:16, padding:'16px 18px', cursor:'pointer', transition:'transform .15s', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}
                        onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
                        onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                        <div style={{ fontSize:11, color: PASTEL[t.color]?.text, fontWeight:700, marginBottom:6, opacity:.7 }}>{t.deadline}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', lineHeight:1.3 }}>{t.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BOARD */}
          {view==='board' && (
            <div>
              <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
                {['all','red','yellow','purple','green'].map(c => (
                  <button key={c} onClick={()=>setSearch(c==='all'?'':c)}
                    style={{ padding:'6px 16px', borderRadius:20, border:'1.5px solid', fontSize:12, fontWeight:600, cursor:'pointer',
                      borderColor: c==='all'?'#5C6BC0': PASTEL[c]?.dot||'#ddd',
                      background: c==='all'?'#5C6BC0': PASTEL[c]?.bg||'#f5f5f5',
                      color: c==='all'?'#fff': PASTEL[c]?.text||'#666' }}>
                    {c==='all'?'Все': c==='red'?'Срочно': c==='yellow'?'Важно': c==='purple'?'Средние':'Мелкие'}
                  </button>
                ))}
              </div>

              {filteredTasks.length === 0 ? (
                <div style={{ textAlign:'center', padding:'80px 0', color:'#ccc' }}>
                  <LayoutGrid size={48} style={{ marginBottom:16, opacity:.3 }}/>
                  <p style={{ fontSize:16, fontWeight:600 }}>Задач нет. Добавь первую!</p>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16 }}>
                  {filteredTasks.map(task => {
                    const p = PASTEL[task.color] || PASTEL.green;
                    const done = task.steps.filter(s=>s.completed).length;
                    const pct = task.steps.length ? Math.round(done/task.steps.length*100) : 0;
                    return (
                      <div key={task.id} onClick={()=>setActiveTaskId(task.id)}
                        style={{ background: p.bg, borderRadius:20, padding:'20px 22px', cursor:'pointer',
                          transition:'transform .15s, box-shadow .15s', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}
                        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'}}
                        onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.06)'}}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                          <span style={{ fontSize:10, fontWeight:700, color:p.text, opacity:.7, textTransform:'uppercase', letterSpacing:1 }}>{task.deadline}</span>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:p.dot }}/>
                        </div>
                        <h3 style={{ margin:'0 0 16px', fontSize:15, fontWeight:700, color:'#1a1a2e', lineHeight:1.4 }}>{task.title}</h3>
                        {task.steps.length > 0 && (
                          <>
                            <div style={{ height:4, background:'rgba(255,255,255,0.5)', borderRadius:4, marginBottom:8 }}>
                              <div style={{ height:'100%', width:`${pct}%`, background:p.dot, borderRadius:4, transition:'width .3s' }}/>
                            </div>
                            <span style={{ fontSize:11, color:p.text, opacity:.7 }}>{done}/{task.steps.length} шагов</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CALENDAR */}
          {view==='calendar' && (
            <div style={{ maxWidth:700, margin:'0 auto', background:'#fff', borderRadius:24, boxShadow:'0 4px 24px rgba(0,0,0,0.06)', overflow:'hidden' }}>
              <div style={{ background:'#5C6BC0', padding:'24px 32px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'#fff' }}>
                <button onClick={()=>setCurrentDate(new Date(currentDate.getFullYear(),currentDate.getMonth()-1,1))}
                  style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, padding:'6px 12px', color:'#fff', cursor:'pointer' }}>
                  <ChevronLeft size={18}/>
                </button>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:800 }}>{months[currentDate.getMonth()]}</div>
                  <div style={{ fontSize:13, opacity:.8 }}>{currentDate.getFullYear()}</div>
                </div>
                <button onClick={()=>setCurrentDate(new Date(currentDate.getFullYear(),currentDate.getMonth()+1,1))}
                  style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, padding:'6px 12px', color:'#fff', cursor:'pointer' }}>
                  <ChevronRight size={18}/>
                </button>
              </div>
              <div style={{ padding:'24px 32px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:8 }}>
                  {days.map(d=><div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#bbb', padding:'8px 0' }}>{d}</div>)}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                  {Array(firstDay).fill(null).map((_,i)=><div key={`e${i}`}/>)}
                  {Array(daysInMonth).fill(null).map((_,i)=>{
                    const day=i+1;
                    const ds=`${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const dt=tasks.filter(t=>t.deadline===ds);
                    const isToday=new Date().toDateString()===new Date(currentDate.getFullYear(),currentDate.getMonth(),day).toDateString();
                    return (
                      <div key={day} style={{ minHeight:60, padding:6, borderRadius:10, background:isToday?'#F0F1FF':'transparent', border:`1px solid ${isToday?'#C5CAE9':'#f0f0f0'}` }}>
                        <div style={{ fontSize:12, fontWeight: isToday?800:500, color: isToday?'#5C6BC0':'#666', marginBottom:4 }}>{day}</div>
                        {dt.slice(0,2).map(t=>(
                          <div key={t.id} onClick={()=>{setActiveTaskId(t.id);setView('board');}}
                            style={{ fontSize:9, padding:'2px 4px', borderRadius:4, background:PASTEL[t.color]?.bg, color:PASTEL[t.color]?.text, marginBottom:2, fontWeight:600, cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {t.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {view==='settings' && (
            <div style={{ maxWidth:460, margin:'0 auto' }}>
              <div style={{ background:'#fff', borderRadius:24, padding:36, boxShadow:'0 4px 24px rgba(0,0,0,0.06)' }}>
                <h2 style={{ margin:'0 0 28px', fontSize:20, fontWeight:800, color:'#1a1a2e' }}>Настройки</h2>
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#aaa', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>Твоё имя</label>
                  <input value={userName} onChange={e=>setUserName(e.target.value)}
                    style={{ width:'100%', padding:'12px 16px', border:'1.5px solid #EBEBEB', borderRadius:12, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}/>
                </div>
                <div style={{ marginBottom:28 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#aaa', marginBottom:8, textTransform:'uppercase', letterSpacing:1 }}>Gemini API Key</label>
                  <input type="password" value={userApiKey} onChange={e=>setUserApiKey(e.target.value)} placeholder="AIzaSy..."
                    style={{ width:'100%', padding:'12px 16px', border:'1.5px solid #EBEBEB', borderRadius:12, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}/>
                  <p style={{ margin:'8px 0 0', fontSize:12, color:'#bbb' }}>Ключ хранится только в твоём браузере.</p>
                </div>
                <button onClick={()=>saveSettings(userName,userApiKey)}
                  style={{ width:'100%', padding:'14px', background:'#5C6BC0', color:'#fff', border:'none', borderRadius:14, fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <Save size={16}/> Сохранить
                </button>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Detail Modal */}
      {activeTask && (
        <div onClick={closeDetail} style={{ position:'fixed', inset:0, background:'rgba(30,30,60,0.35)', backdropFilter:'blur(8px)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:28, width:'100%', maxWidth:460, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
            {/* Modal Header */}
            <div style={{ background: PASTEL[activeTask.color]?.bg||'#eee', padding:'24px 28px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:11, color: PASTEL[activeTask.color]?.text, fontWeight:700, opacity:.7, marginBottom:4 }}>ДЕДЛАЙН: {activeTask.deadline}</div>
                <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'#1a1a2e' }}>{activeTask.title}</h3>
              </div>
              <button onClick={closeDetail} style={{ background:'rgba(255,255,255,0.5)', border:'none', borderRadius:50, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X size={16}/>
              </button>
            </div>
            {/* Modal Body */}
            <div style={{ padding:'24px 28px', overflowY:'auto', flex:1 }}>
              {activeTask.reasoning && (
                <div style={{ background:'#F8F8FC', borderRadius:14, padding:'14px 18px', marginBottom:20 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#5C6BC0', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>Анализ AI</div>
                  <p style={{ margin:0, fontSize:13, color:'#666', lineHeight:1.6 }}>{activeTask.reasoning}</p>
                </div>
              )}
              <div style={{ fontSize:10, fontWeight:700, color:'#5C6BC0', marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>План ({activeTask.steps.filter(s=>s.completed).length}/{activeTask.steps.length})</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {activeTask.steps.map((step, idx) => (
                  <div key={idx} onClick={()=>toggleStep(activeTask.id,idx)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:12,
                      background: step.completed?'#F0F1FF':'#F8F8FC', border:'1.5px solid', borderColor: step.completed?'#C5CAE9':'#EBEBEB', cursor:'pointer', transition:'all .15s' }}>
                    {step.completed ? <CheckCircle2 size={20} color="#5C6BC0"/> : <Circle size={20} color="#ddd"/>}
                    <span style={{ fontSize:13, fontWeight:600, color: step.completed?'#5C6BC0':'#444', textDecoration: step.completed?'line-through':'none' }}>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Modal Footer */}
            <div style={{ padding:'16px 28px', borderTop:'1px solid #EBEBEB', display:'flex', justifyContent:'flex-end' }}>
              <button onClick={()=>deleteTask(activeTask.id)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', background:'#FFF0F0', color:'#e74c3c', border:'none', borderRadius:12, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                <Trash2 size={15}/> Удалить задачу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;