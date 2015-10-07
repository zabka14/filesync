'use strict';
angular
  .module('FileSync')
  .controller('SocialCtrl', ['$scope', 'SocketIOService', function($scope, SocketIOService) {
    this.viewers = [];
    this.messages = [];
    this.message;

    function onViewersUpdated(viewers) {
      this.viewers = viewers;
      $scope.$apply();
    }

    function onMessage(messages) {
      this.messages = messages;
      $scope.$apply();
    }

    this.sendMessage = function() {
    	SocketIOService.messageUpdate(this.message);
      this.message = "";
    }

   	SocketIOService.onMessage(onMessage.bind(this));
    SocketIOService.onViewersUpdated(onViewersUpdated.bind(this));
  }]);
