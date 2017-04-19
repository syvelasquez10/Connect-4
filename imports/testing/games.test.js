//Creo que este test unitario para el juego está bastante completo, pero si quedo con la duda de si los métodos que tienen se pueden ejecutar sin login


/* eslint-env mocha */
/* eslint prefer-arrow-callback: "off"*/
/* eslint func-names: "off"*/
/* eslint no-underscore-dangle: ["error", { "allow": ["_id"] }]*/
/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }]*/
/* eslint "import/no-unresolved": [0]*/
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { assert } from 'meteor/practicalmeteor:chai';
import { resetDatabase } from 'meteor/xolvio:cleaner';

import { Games } from '../api/games.js';

if (Meteor.isServer) {
  describe('Games', function () {
    const userId = Random.id();
    const username = 'user1';
    beforeEach(function () {
      resetDatabase();
    });
    //Creo que no hay necesidad de resetaer la base de datos al terminar la prueba porque igualmente se va a resetear antes de empezar la siguiente
  /*
    afterEach(function () {
      resetDatabase();
    });*/

    //Nose si en esta parte se deba estar logueado, pero creo que si. Pueden utilizar un mock del Meteor.user para simular el login
    function create(p) {
      const createGame = Meteor.server.method_handlers['games.newGame'];
      const invocation = { userId, username };
      createGame.apply(invocation, [p]);
    }

    //Lo mismo del login es esta
    function join(userId2, username2) {
      const gameId = Games.find({ p: false }).fetch()[0]._id;
      const joinGame = Meteor.server.method_handlers['games.join'];
      const invocation = { userId: userId2, username: username2 };
      joinGame.apply(invocation, [gameId]);
      return gameId;
    }

    it('can create a public game', function () {
      create(false);
      assert.equal(Games.find({ p: false }).count(), 1);
    });

    it('can create a private game', function () {
      create(true);
      assert.equal(Games.find({ p: true }).count(), 1);
    });

    it('can join a game', function () {
      create(false);
      const userId2 = Random.id();
      const username2 = 'user2';
      join(userId2, username2);
      const games = Games.find({ $and: [
        { 'p1._id': { $eq: userId } },
        { 'p1.username': { $eq: username } },
        { 'p2._id': { $eq: userId2 } },
        { 'p2.username': { $eq: username2 } },
      ] });
      assert.equal(games.count(), 1);
    });

    describe('gameplay', function () {
      const userId2 = Random.id();
      const username2 = 'user2';
      let gameId;
      const invocation = { userId, username };
      const invocation2 = { userId: userId2, username: username2 };
      beforeEach(function () {
        create(false);
        gameId = join(userId2, username2);
      });

      it('doesn\'t move if not in turn', function () {
        try {
          const move = Meteor.server.method_handlers['games.move'];
          move.apply(invocation2, [gameId, 1]);
          assert.equal(true, false);
        } catch (e) {
          assert.equal(true, true);
        }
      });

      it('can make a move on a game', function () {
        const move = Meteor.server.method_handlers['games.move'];
        let turnP1 = true;
        for (let i = 0; i < 7; i++) {
          for (let j = 0; j < 6; j++) {
            const inv = turnP1 ? invocation : invocation2;
            move.apply(inv, [gameId, i]);
            turnP1 = !turnP1;
          }

          // No deberia poder mover pues esta llena la columna
          const inv = turnP1 ? invocation : invocation2;
          try {
            move.apply(inv, [gameId, i]);
            assert.equal(true, false);
          } catch (e) {
            assert.equal(true, true);
          }
        }
      });

      it('can end a game', function () {
        const end = Meteor.server.method_handlers['games.end'];
        end.apply(invocation, [gameId]);
        assert.equal(Games.find({ state: { $eq: 'ended' } }).count(), 1);
      });

      it('can end give up', function () {
        const end = Meteor.server.method_handlers['games.giveUp'];
        end.apply(invocation, [gameId]);
        assert.equal(Games.find({ givesUp: { $eq: true } }).count(), 1);
      });

      it('can set winner', function () {
        const move = Meteor.server.method_handlers['games.move'];
        const winner = Meteor.server.method_handlers['games.winner'];
        for (let i = 0; i < 4; i++) {
          move.apply(invocation, [gameId, 0]);
          if (i !== 3) {
            move.apply(invocation2, [gameId, 1]);
          }
        }
        winner.apply(invocation, [gameId]);
        assert.equal(Games.find({ winner: { $eq: username } }).count(), 1);
      });

      it('can set tie', function () {
        const move = Meteor.server.method_handlers['games.move'];
        const winner = Meteor.server.method_handlers['games.winner'];
        for (let i = 0; i < 4; i++) {
          move.apply(invocation, [gameId, 0]);
          move.apply(invocation2, [gameId, 1]);
        }
        winner.apply(invocation, [gameId]);
        assert.equal(Games.find({ winner: { $eq: 'tie' } }).count(), 1);
      });

      describe('chat', function () {
        it('can send message', function () {
          const chat = Meteor.server.method_handlers['games.chat'];
          const msgs = ['hola', 'voy a ganar', 'lok'];
          chat.apply(invocation, [gameId, msgs[0]]);
          chat.apply(invocation2, [gameId, msgs[1]]);
          chat.apply(invocation, [gameId, msgs[2]]);
          const savedChat = Games.findOne(gameId).chat;
          for (let i = 0; i < msgs.length; i++) {
            assert.equal(msgs[i], savedChat[i]);
          }
        });
      });
    });
  });
}
