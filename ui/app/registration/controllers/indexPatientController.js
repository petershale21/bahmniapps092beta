'use strict';

angular.module('bahmni.registration')
    .controller('IndexPatientController', ['$scope', '$rootScope', '$http', 'patientAttributeService', 'appService', 'spinner', '$location', 'ngDialog', '$window', '$state',
        function ($scope, $rootScope, $http, patientAttributeService, appService, spinner, $location, ngDialog, $window, $state) {
            var autoCompleteFields = appService.getAppDescriptor().getConfigValue("autoCompleteFields", []);
            var showCasteSameAsLastNameCheckbox = appService.getAppDescriptor().getConfigValue("showCasteSameAsLastNameCheckbox");
            var personAttributes = [];
            var caste;
            
      $scope.changeView = function(patient) {
        console.log(patient)
        return patient;
      };
      
      
        }]);

