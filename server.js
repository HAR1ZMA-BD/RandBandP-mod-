const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Хранилище сессий
const sessions = {};

wss.on('connection', function connection(ws) {
  let currentUser = null;

  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);
    
    if (data.type === 'auth') {
      // Аутентификация пользователя
      currentUser = {
        username: data.user,
        role: data.role,
        session: data.session
      };
      
      // Инициализация сессии, если ее нет
      if (!sessions[data.session]) {
        sessions[data.session] = {
          red: null,
          blue: null,
          observers: []
        };
      }
      
      // Добавляем пользователя в сессию
      if (data.role === 'red') {
        sessions[data.session].red = ws;
      } else if (data.role === 'blue') {
        sessions[data.session].blue = ws;
      } else {
        sessions[data.session].observers.push(ws);
      }
      
      // Отправляем статус подключения
      broadcastStatus(data.session);
      
      // Приветственное сообщение
      ws.send(JSON.stringify({
        type: 'event',
        text: `Добро пожаловать, ${data.role} ${data.user}!`,
        sender: 'Система'
      }));
    } else if (data.type === 'attack' && currentUser.role === 'red') {
      // Обработка атаки от Red Team
      const session = sessions[data.session];
      if (session && session.blue) {
        // Отправляем Blue Team уведомление об атаке
        session.blue.send(JSON.stringify({
          type: 'attack',
          attack: data.attack,
          user: data.user
        }));
        
        // Симулируем результат атаки (в реальном приложении это было бы сложнее)
        setTimeout(() => {
          const success = Math.random() > 0.5; // 50% шанс успеха
          
          // Отправляем результат Red Team
          ws.send(JSON.stringify({
            type: 'attack_result',
            attack: data.attack,
            success
          }));
          
          // Отправляем результат Blue Team
          if (session.blue) {
            session.blue.send(JSON.stringify({
              type: 'attack_result',
              attack: data.attack,
              success: !success // Если атака успешна, защита провалена и наоборот
            }));
          }
        }, 2000);
      }
    } else if (data.type === 'defense' && currentUser.role === 'blue') {
      // Обработка защиты от Blue Team
      const session = sessions[data.session];
      if (session && session.red) {
        // Отправляем Red Team уведомление о защите
        session.red.send(JSON.stringify({
          type: 'defense',
          defense: data.defense,
          user: data.user
        }));
        
        // Симулируем результат защиты
        setTimeout(() => {
          const success = Math.random() > 0.5; // 50% шанс успеха
          
          // Отправляем результат Blue Team
          ws.send(JSON.stringify({
            type: 'defense_result',
            defense: data.defense,
            success
          }));
          
          // Отправляем результат Red Team
          if (session.red) {
            session.red.send(JSON.stringify({
              type: 'defense_result',
              defense: data.defense,
              success: !success
            }));
          }
        }, 2000);
      }
    }
  });

  ws.on('close', function() {
    if (currentUser && sessions[currentUser.session]) {
      // Удаляем пользователя из сессии
      const session = sessions[currentUser.session];
      if (currentUser.role === 'red') {
        session.red = null;
      } else if (currentUser.role === 'blue') {
        session.blue = null;
      } else {
        session.observers = session.observers.filter(obs => obs !== ws);
      }
      
      broadcastStatus(currentUser.session);
    }
  });
});

// Функция рассылки статуса подключения
function broadcastStatus(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;
  
  // Отправляем Red Team статус Blue Team
  if (session.red) {
    session.red.send(JSON.stringify({
      type: 'status',
      role: 'blue',
      connected: !!session.blue
    }));
  }
  
  // Отправляем Blue Team статус Red Team
  if (session.blue) {
    session.blue.send(JSON.stringify({
      type: 'status',
      role: 'red',
      connected: !!session.red
    }));
  }
  
  // Можно также отправлять статус наблюдателям
  session.observers.forEach(obs => {
    obs.send(JSON.stringify({
      type: 'status',
      redConnected: !!session.red,
      blueConnected: !!session.blue
    }));
  });
}

console.log('WebSocket сервер запущен на ws://localhost:8080');