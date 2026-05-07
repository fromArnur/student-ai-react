import React, { useState, useEffect } from 'react';
import { 
  Send, 
  LayoutGrid, 
  PlusCircle, 
  ArrowLeft, 
  CheckCircle2, 
  Circle, 
  X, 
  ChevronRight,
  AlertCircle,
  Calendar as CalendarIcon,
  ChevronLeft,
  Settings as SettingsIcon,
  Save
} from 'lucide-react';

const App = () => {
  // --- Persistent State (localStorage) ---
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('agent_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('agent_user_name') || 'Старина';
  });

  const [userApiKey, setUserApiKey] = useState(() => {
    return localStorage.getItem('agent_api_key') || '';
  });

  // --- UI State ---
  const [view, setView] = useState('home'); // 'home', 'board', 'calendar', 'settings'
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingTask, setPendingTask] = useState(null); 
  const [activeTaskId, setActiveTaskId] = useState(null); 
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- Persistence Sync ---
  useEffect(() => {
    localStorage.setItem('agent_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const saveSettings = (name, key) => {
    localStorage.setItem('agent_user_name', name);
    localStorage.setItem('agent_api_key', key);
    setUserName(name);
    setUserApiKey(key);
    setView('home');
  };

  const activeTask = tasks.find(t => t.id === activeTaskId);

  const closeDetail = () => {
    setActiveTaskId(null);
  };

  // --- API Logic ---
  const callGemini = async (prompt) => {
    if (!userApiKey) {
      throw new Error("Зайди в настройки и вставь свой API-ключ, иначе я буду молчать как партизан.");
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: {
        parts: [{ text: `Ты — саркастичный и ироничный AI-агент для студента по имени ${userName}. Твоя задача — анализировать хаотичный ввод. ТЫ ОБЯЗАН возвращать дату в формате YYYY-MM-DD. Не делай все задачи красными (red)! Используй yellow для важных, но не срочных, purple для мелких хлопот и green для ерунды. Будь строгим критиком лени.` }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            isDeadlineMissing: { type: "BOOLEAN" },
            title: { type: "STRING" },
            deadline: { type: "STRING" }, 
            priorityColor: { type: "STRING", enum: ["red", "purple", "yellow", "green"] },
            reasoning: { type: "STRING" },
            steps: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: { text: { type: "STRING" }, completed: { type: "BOOLEAN" } }
              }
            }
          }
        }
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error("API не отвечает. Либо ключ кривой, либо Google нас забанил.");
    
    const result = await response.json();
    return JSON.parse(result.candidates[0].content.parts[0].text);
  };

  const handleAddTask = async (e) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const prompt = pendingTask 
        ? `Сегодня ${today}. Пользователь ${userName} уточнил дедлайн для задачи "${pendingTask.rawInput}": "${inputValue}". Разбери задачу и выдай JSON.`
        : `Сегодня ${today}. Разбери задачу пользователя ${userName}: "${inputValue}". Если даты нет, установи isDeadlineMissing: true.`;

      const aiResponse = await callGemini(prompt);

      if (aiResponse.isDeadlineMissing && !pendingTask) {
        setPendingTask({ rawInput: inputValue });
        setInputValue('');
        setIsProcessing(false);
        return;
      }

      const newTask = {
        id: Date.now(),
        title: aiResponse.title || (pendingTask ? pendingTask.rawInput : inputValue),
        deadline: aiResponse.deadline || today,
        color: aiResponse.priorityColor || "green",
        steps: aiResponse.steps || [],
        reasoning: aiResponse.reasoning || "Я ИИ, я так чувствую.",
        createdAt: new Date().toLocaleDateString()
      };

      setTasks([...tasks, newTask]);
      setInputValue('');
      setPendingTask(null);
      setTimeout(() => setView('board'), 300);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleStep = (taskId, stepIndex) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newSteps = [...t.steps];
        newSteps[stepIndex].completed = !newSteps[stepIndex].completed;
        return { ...t, steps: newSteps };
      }
      return t;
    }));
  };

  const getColorClass = (color) => {
    switch (color) {
      case 'red': return 'bg-red-100 border-red-300 text-red-800';
      case 'purple': return 'bg-purple-100 border-purple-300 text-purple-800';
      case 'yellow': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'green': return 'bg-green-100 border-green-300 text-green-800';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  // --- Calendar Helpers ---
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const calendarDays = [];
    
    for (let i = 0; i < firstDay; i++) calendarDays.push(<div key={`empty-${i}`} className="h-16 sm:h-24 bg-slate-50/30"></div>);

    for (let day = 1; day <= daysCount; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = tasks.filter(t => t.deadline === dateStr);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

      calendarDays.push(
        <div key={day} className="h-16 sm:h-24 p-1 sm:p-2 border border-slate-50 bg-white relative hover:bg-indigo-50/20 transition-all">
          <span className={`text-[10px] sm:text-xs font-black ${isToday ? 'bg-indigo-600 text-white w-5 h-5 flex items-center justify-center rounded-full' : 'text-slate-300'}`}>
            {day}
          </span>
          <div className="mt-1 flex flex-wrap gap-0.5">
            {dayTasks.map(t => (
              <div key={t.id} onClick={() => { setActiveTaskId(t.id); setView('board'); }} className={`w-full h-1 sm:h-1.5 rounded-full ${t.color === 'red' ? 'bg-red-400' : t.color === 'purple' ? 'bg-purple-400' : t.color === 'yellow' ? 'bg-yellow-400' : 'bg-green-400'} cursor-pointer hover:scale-110 transition-transform`}></div>
            ))}
          </div>
        </div>
      );
    }
    return calendarDays;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100">
      
      {/* Header */}
      <header className="p-4 sm:p-6 flex justify-between items-center max-w-5xl mx-auto w-full sticky top-0 bg-slate-50/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <LayoutGrid size={20} />
          </div>
          <h1 className="text-xl font-black tracking-tighter hidden sm:block uppercase">Task.Agent</h1>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setView('calendar')} className={`p-2 sm:px-4 sm:py-2 rounded-full transition-all font-bold text-xs flex items-center gap-2 ${view === 'calendar' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 hover:shadow-md'}`}>
            <CalendarIcon size={14} /> <span className="hidden sm:inline">Календарь</span>
          </button>
          <button onClick={() => setView('board')} className={`p-2 sm:px-4 sm:py-2 rounded-full transition-all font-bold text-xs flex items-center gap-2 ${view === 'board' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 hover:shadow-md'}`}>
            <LayoutGrid size={14} /> <span className="hidden sm:inline">Доска</span>
          </button>
          <button onClick={() => setView('settings')} className={`p-2 sm:px-4 sm:py-2 rounded-full transition-all font-bold text-xs flex items-center gap-2 ${view === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 hover:shadow-md'}`}>
            <SettingsIcon size={14} /> <span className="hidden sm:inline">Настройки</span>
          </button>
          {view !== 'home' && (
            <button onClick={() => setView('home')} className="p-2 sm:px-4 sm:py-2 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-bold text-xs hover:bg-indigo-100 transition-all">
              <PlusCircle size={14} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        
        {/* View: Home */}
        {view === 'home' && (
          <div className="flex flex-col items-center justify-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 min-h-[50vh]">
            <div className="text-center space-y-4">
              <h2 className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tight">
                {pendingTask ? "А когда дедлайн, умник?" : `Чё застрял, ${userName}?`}
              </h2>
              <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto font-medium">
                {!userApiKey ? "Сначала зайди в настройки и введи API Key, а потом уже требуй от меня работы." : (pendingTask ? "Назови дату, или я сам её придумаю." : "Пиши задачу. Я сам всё распланирую, пока ты отдыхаешь.")}
              </p>
            </div>

            <form onSubmit={handleAddTask} className="w-full max-w-2xl relative">
              <input autoFocus type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={pendingTask ? "Напр: 25 мая, завтра..." : "Напр: Сделать курсач..."} disabled={isProcessing || !userApiKey} className="w-full p-5 sm:p-7 pr-16 sm:pr-24 text-lg sm:text-2xl bg-white border-2 border-slate-100 rounded-[2rem] shadow-2xl focus:border-indigo-400 focus:outline-none transition-all placeholder:text-slate-200 font-bold disabled:bg-slate-50" />
              <button type="submit" disabled={isProcessing || !inputValue.trim() || !userApiKey} className="absolute right-3 top-3 sm:right-4 sm:top-4 p-4 sm:p-5 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-indigo-700 disabled:bg-slate-100 transition-all active:scale-90"><Send size={24} /></button>
            </form>

            {error && <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 animate-pulse"><AlertCircle size={18} /> <span className="text-sm font-bold">{error}</span></div>}
          </div>
        )}

        {/* View: Settings */}
        {view === 'settings' && (
          <div className="max-w-md mx-auto animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
              <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-8">Настройки</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 ml-4 mb-2 block">Как тебя звать?</label>
                  <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none font-bold transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 ml-4 mb-2 block">Gemini API Key</label>
                  <input type="password" value={userApiKey} onChange={(e) => setUserApiKey(e.target.value)} placeholder="Вставь сюда свой ключ..." className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none font-bold transition-all" />
                </div>
                <button onClick={() => saveSettings(userName, userApiKey)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                  <Save size={18} /> Сохранить
                </button>
              </div>
              <p className="mt-8 text-[10px] text-slate-300 font-bold text-center leading-relaxed">Твои данные хранятся только в твоем браузере. Я не ворую ключи, мне лень.</p>
            </div>
          </div>
        )}

        {/* View: Board & Calendar (Same as before but integrated) */}
        {view === 'board' && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
             <div className="mb-10">
                <h2 className="text-4xl font-black text-slate-800 tracking-tighter italic uppercase">Твои Хвосты</h2>
                <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">Список дел для {userName}</p>
              </div>
            {tasks.length === 0 ? (
              <div className="text-center py-32 bg-white border-4 border-dashed border-slate-100 rounded-[3rem]"><p className="text-slate-300 font-black text-2xl uppercase italic">Пусто. Либо ты гений, либо мастер лени.</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {tasks.map(task => (
                  <div key={task.id} onClick={() => setActiveTaskId(task.id)} className={`p-8 rounded-[2rem] border-b-8 shadow-lg hover:shadow-2xl cursor-pointer transition-all transform hover:-translate-y-2 active:scale-95 ${getColorClass(task.color)}`}>
                    <div className="flex justify-between items-start mb-6"><span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{task.color === 'red' ? 'ОПАСНО' : 'ЗАДАЧА'}</span><ChevronRight size={20} className="opacity-20" /></div>
                    <h3 className="text-xl font-black leading-none mb-4 uppercase italic">{task.title}</h3>
                    <p className="text-xs font-bold opacity-60">СРОК: {task.deadline}</p>
                    <div className="mt-8 flex gap-1.5">{task.steps.map((s, i) => <div key={i} className={`w-2 h-2 rounded-full ${s.completed ? 'bg-indigo-600' : 'bg-white opacity-50'}`}></div>)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'calendar' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500 max-w-4xl mx-auto">
            <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
              <div className="p-6 sm:p-10 bg-indigo-600 text-white flex justify-between items-center">
                <button onClick={() => setView('board')} className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/40 rounded-xl transition-all text-xs font-black uppercase tracking-widest"><ArrowLeft size={16} /> <span>Назад</span></button>
                <div className="text-center"><h2 className="text-3xl font-black uppercase italic tracking-tighter">{months[currentDate.getMonth()]}</h2><p className="text-xs font-bold opacity-70 tracking-[0.5em]">{currentDate.getFullYear()}</p></div>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white/20 rounded-xl transition-all"><ChevronLeft size={24} /></button>
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white/20 rounded-xl transition-all"><ChevronRight size={24} /></button>
                </div>
              </div>
              <div className="p-10">
                <div className="grid grid-cols-7 mb-6">{days.map(d => <div key={d} className="text-center text-[10px] font-black uppercase text-slate-300 tracking-widest pb-4">{d}</div>)}</div>
                <div className="grid grid-cols-7 border-t border-l border-slate-50">{renderCalendar()}</div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Detail Modal */}
      {activeTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={closeDetail}>
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className={`p-8 ${getColorClass(activeTask.color)} border-none flex justify-between items-center shrink-0`}>
              <button onClick={closeDetail} className="flex items-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/40 rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest">
                <ArrowLeft size={14} /> <span>Назад</span>
              </button>
              <X size={24} className="cursor-pointer opacity-40 hover:opacity-100" onClick={closeDetail} />
            </div>
            <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 block">Дедлайн: {activeTask.deadline}</span>
              <h3 className="text-3xl font-black text-slate-800 mb-8 uppercase italic leading-none tracking-tighter">{activeTask.title}</h3>
              <div className="mb-10">
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-4">Анализ эксперта:</h4>
                <p className="text-slate-500 text-sm leading-relaxed bg-slate-50 p-6 rounded-3xl border border-slate-100 italic font-bold">"{activeTask.reasoning}"</p>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-4">План выживания:</h4>
                {activeTask.steps.map((step, idx) => (
                  <div key={idx} onClick={() => toggleStep(activeTask.id, idx)} className={`flex items-center gap-4 p-5 rounded-[1.5rem] border-2 cursor-pointer transition-all ${step.completed ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-50 hover:border-slate-100'}`}>
                    {step.completed ? <CheckCircle2 size={24} className="text-indigo-600" /> : <Circle size={24} className="text-slate-100" />}
                    <span className={`text-sm font-black uppercase italic ${step.completed ? 'line-through text-indigo-200' : 'text-slate-700'}`}>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;