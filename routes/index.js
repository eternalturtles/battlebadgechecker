var express = require('express');
var ensureLogIn = require('connect-ensure-login').ensureLoggedIn;
var db = require('../db');

var ensureLoggedIn = ensureLogIn();

function fetchTodos(req, res, next) {
  db.all('SELECT * FROM todos WHERE owner_id = ?', [
    req.user.id
  ], function(err, rows) {
    if (err) { return next(err); }
    
    var todos = rows.map(function(row) {
      return {
        id: row.id,
        title: row.title,
        completed: row.completed == 1 ? true : false,
        url: '/' + row.id
      }
    });
    res.locals.todos = todos;
    res.locals.activeCount = todos.filter(function(todo) { return !todo.completed; }).length;
    res.locals.completedCount = todos.length - res.locals.activeCount;
    next();
  });
}

function checkOwner(req, res, next){
  if(req.user.username == 'eternalturt'){
    next();
  } else {
    res.redirect('/');
  }
}

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  if (!req.user) { return res.render('home'); }
  next();
}, fetchTodos, function(req, res, next) {
  let whitelist_out;
  if (req.user.whitelist == 'yes') {
    whitelist_out = true
  } else {
    whitelist_out = false
  }
  res.locals.filter = null;

  db.get("SELECT * FROM users_random_numbers WHERE user_id = ?", [req.user.id], function (err, row) {
    if(row) {
      return res.render('index', { user: req.user,  whitelist_out: whitelist_out, random_number: true });
    }
    
    return res.render('index', { user: req.user,  whitelist_out: whitelist_out });
  })
  
});

router.get('/active', ensureLoggedIn, fetchTodos, function(req, res, next) {
  res.locals.todos = res.locals.todos.filter(function(todo) { return !todo.completed; });
  res.locals.filter = 'active';
  res.render('index', { user: req.user });
});

router.get('/completed', ensureLoggedIn, fetchTodos, function(req, res, next) {
  res.locals.todos = res.locals.todos.filter(function(todo) { return todo.completed; });
  res.locals.filter = 'completed';
  res.render('index', { user: req.user });
});

router.get('/random-url', ensureLoggedIn, checkOwner, function(req, res, next) {  
  db.all('SELECT * FROM random_numbers', [], function(err, rows) {
    if (err) { return next(err); }
    var random_numbers = rows.map(function(row) {
      return {
        id: row.id,
        number: row.number,
        url: '/' + row.id
      }
    });
    res.locals.random_numbers = random_numbers;
    res.render('random-url');
  });
})

router.get('/:number', function(req, res){
  const number = req.params.number;
  db.get("SELECT * FROM random_numbers WHERE number = ?", [number], function (err, row) {
    if(row){
      res.render('home', { number: number});
    } else {
      res.redirect('/');
    }
  })
})

router.post('/', ensureLoggedIn, function(req, res, next) {
  req.body.address = req.body.address.trim();
  next();
}, function(req, res, next) {
  if (req.body.address !== '') { return next(); }
  return res.redirect('/' + (req.body.filter || ''));
}, function(req, res, next) {
  db.run('UPDATE users SET address = ? WHERE id = ?', [
    req.body.address,
    req.user.id,
  ], function(err) {
    if (err) { return next(err); }
    req.session.messages = ["Your wallet address has been successfully submitted. Please refresh the page if you wish to redownload your battle badge or resubmit your wallet"]
    return res.redirect('/' + (req.body.filter || ''));
  });
});

router.post('/:id(\\d+)', ensureLoggedIn, function(req, res, next) {
  req.body.title = req.body.title.trim();
  next();
}, function(req, res, next) {
  if (req.body.title !== '') { return next(); }
  db.run('DELETE FROM todos WHERE id = ? AND owner_id = ?', [
    req.params.id,
    req.user.id
  ], function(err) {
    if (err) { return next(err); }
    return res.redirect('/' + (req.body.filter || ''));
  });
}, function(req, res, next) {
  db.run('UPDATE todos SET title = ?, completed = ? WHERE id = ? AND owner_id = ?', [
    req.body.title,
    req.body.completed !== undefined ? 1 : null,
    req.params.id,
    req.user.id
  ], function(err) {
    if (err) { return next(err); }
    return res.redirect('/' + (req.body.filter || ''));
  });
});

router.post('/random-url', ensureLoggedIn, checkOwner, function(req, res, next) {
  req.body.number = req.body.number.trim();
  next();
}, function(req, res, next) {
  if (req.body.number !== '') { return next(); }
  return res.redirect('/random-url');
}, function(req, res, next) {
  db.run('INSERT INTO random_numbers (number) VALUES (?)', [
    req.body.number
  ], function(err) {
    if (err) { return next(err); }
    
    return res.redirect('/random-url');
  });
});

router.post('/random-url/:id(\\d+)/delete', ensureLoggedIn, checkOwner, function(req, res, next) {
  db.run('DELETE FROM random_numbers WHERE id = ? ', [
    req.params.id,
  ], function(err) {
    if (err) { return next(err); }

    db.run('DELETE FROM users_random_numbers WHERE random_number_id = ? ', [
      req.params.id
    ], function(err) {
      if (err) { return next(err); }

      return res.redirect('/random-url');
    });
  });
});

module.exports = router;
