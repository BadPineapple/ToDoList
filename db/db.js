const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'todo.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB] Failed to connect to database:', err);
  } else {
    console.log('[DB] Connected to database at', dbPath);
  }
});

// Create tables if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tbllistas (
      IDLISTA     INTEGER PRIMARY KEY,
      NOME        TEXT NOT NULL,
      DESCRICAO   TEXT,
      OCULTO      BOOLEAN DEFAULT 0,
      DTINICIAL   DATE DEFAULT CURRENT_DATE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tbltarefas (
      IDTAREFA     INTEGER PRIMARY KEY,
      NOME         TEXT NOT NULL,
      DESCRICAO    TEXT,
      LINKUM       TEXT,
      LINKDOIS     TEXT,
      NOTIFICAR    BOOLEAN DEFAULT 0,
      CONCLUIDO    BOOLEAN DEFAULT 0,
      OCULTO       BOOLEAN DEFAULT 0,
      IMPORTANCIA  INTEGER DEFAULT 0,
      DTINICIAL    DATE DEFAULT CURRENT_DATE,
      DTFINAL      DATE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tbltarefaslistas (
      ID        INTEGER PRIMARY KEY,
      IDTAREFA  INTEGER NOT NULL,
      IDLISTA   INTEGER NOT NULL
    )
  `);

  console.log('[DB] Tables verified or created');
});

// Insert new list
async function addList(list) {
  const id = await getNextListId();
  return new Promise((resolve, reject) => {
    const stmt = `
      INSERT INTO tbllistas (IDLISTA, NOME, DESCRICAO, OCULTO)
      VALUES (?, ?, ?, ?)
    `;
    db.run(stmt, [id, list.nome, list.descricao || null, list.oculto ? 1 : 0], function (err) {
      if (err) {
        console.error('[DB] Error inserting list:', err);
        reject(err);
      } else {
        console.log(`[DB] List added: ID ${id}`);
        resolve(id);
      }
    });
  });
}

// Get all visible lists
function getAllLists() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM tbllistas WHERE OCULTO = 0`, (err, rows) => {
      if (err) {
        console.error('[DB] Error loading lists:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Insert task
async function addTask(task) {
  const id = await getNextTaskId();
  return new Promise((resolve, reject) => {
    const stmt = `
      INSERT INTO tbltarefas (
        IDTAREFA, NOME, DESCRICAO, LINKUM, LINKDOIS,
        NOTIFICAR, CONCLUIDO, OCULTO, IMPORTANCIA,
        DTINICIAL, DTFINAL
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(stmt, [
      id,
      task.nome,
      task.descricao || null,
      task.linkum || null,
      task.linkdois || null,
      task.notificar ? 1 : 0,
      task.concluido ? 1 : 0,
      task.oculto ? 1 : 0,
      task.importancia || 0,
      task.dtinicial || new Date().toISOString().split('T')[0],
      task.dtfinal || null
    ], function (err) {
      if (err) {
        console.error('[DB] Error inserting task:', err);
        reject(err);
      } else {
        console.log(`[DB] Task added: ID ${id}`);
        resolve(id);
      }
    });
  });
}

// Relate task to list
async function matchListXTask(taskId, listId) {
  const id = await getNextTaskListId();
  return new Promise((resolve, reject) => {
    const stmt = `INSERT INTO tbltarefaslistas (ID, IDTAREFA, IDLISTA) VALUES (?, ?, ?)`;
    db.run(stmt, [id, taskId, listId], function (err) {
      if (err) {
        console.error('[DB] Error linking task to list:', err);
        reject(err);
      } else {
        console.log(`[DB] Task ${taskId} linked to list ${listId}`);
        resolve(id);
      }
    });
  });
}

// Get tasks for a given list
function getTasksByList(idlista) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT t.* FROM tbltarefas t
      JOIN tbltarefaslistas tl ON tl.IDTAREFA = t.IDTAREFA
      WHERE tl.IDLISTA = ? AND t.OCULTO = 0
    `;
    db.all(query, [idlista], (err, rows) => {
      if (err) {
        console.error('[DB] Error loading tasks by list:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Get next ID for each table
function getNextListId() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT MAX(IDLISTA) AS max FROM tbllistas`, (err, row) => {
      if (err) reject(err);
      else resolve((row?.max || 0) + 1);
    });
  });
}

function getNextTaskId() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT MAX(IDTAREFA) AS max FROM tbltarefas`, (err, row) => {
      if (err) reject(err);
      else resolve((row?.max || 0) + 1);
    });
  });
}

function getNextTaskListId() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT MAX(ID) AS max FROM tbltarefaslistas`, (err, row) => {
      if (err) reject(err);
      else resolve((row?.max || 0) + 1);
    });
  });
}

function deleteList(listId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Buscar tarefas da lista
      db.all(`SELECT IDTAREFA FROM tbltarefaslistas WHERE IDLISTA = ?`, [listId], (err, rows) => {
        if (err) return reject(err);

        const taskIds = rows.map(r => r.IDTAREFA);
        const tasksToDelete = [];

        let pendingChecks = taskIds.length;

        if (pendingChecks === 0) {
          return proceedWithDeletion(); // nenhuma tarefa, pode continuar
        }

        // 2. Verificar para cada tarefa se está em outras listas
        taskIds.forEach(taskId => {
          db.get(
            `SELECT COUNT(*) as count FROM tbltarefaslistas WHERE IDTAREFA = ? AND IDLISTA != ?`,
            [taskId, listId],
            (err2, result) => {
              if (err2) return reject(err2);

              if (result.count === 0) {
                tasksToDelete.push(taskId);
              }

              pendingChecks--;
              if (pendingChecks === 0) {
                proceedWithDeletion();
              }
            }
          );
        });

        function proceedWithDeletion() {
          // 3. Excluir tarefas exclusivas
          tasksToDelete.forEach(taskId => {
            db.run(`DELETE FROM tbltarefas WHERE IDTAREFA = ?`, [taskId]);
          });

          // 4. Excluir vínculos
          db.run(`DELETE FROM tbltarefaslistas WHERE IDLISTA = ?`, [listId]);

          // 5. Excluir a lista
          db.run(`DELETE FROM tbllistas WHERE IDLISTA = ?`, [listId], (err3) => {
            if (err3) return reject(err3);
            resolve(true);
          });
        }
      });
    });
  });
}

function deleteTask(taskId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`DELETE FROM tbltarefaslistas WHERE IDTAREFA = ?`, [taskId], function (err) {
        if (err) return reject(err);
        db.run(`DELETE FROM tbltarefas WHERE IDTAREFA = ?`, [taskId], function (err2) {
          if (err2) reject(err2);
          else resolve(true);
        });
      });
    });
  });
}

function getListById(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM tbllistas WHERE IDLISTA = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function updateList(list) {
  return new Promise((resolve, reject) => {
    const stmt = `UPDATE tbllistas SET NOME = ?, DESCRICAO = ?, OCULTO = ? WHERE IDLISTA = ?`;
    db.run(stmt, [list.nome, list.descricao, list.oculto ? 1 : 0, list.IDLISTA], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = {
  addList,
  getAllLists,
  addTask,
  getListById,
  matchListXTask,
  getTasksByList,
  deleteTask,
  deleteList,
  updateList
};
