'use strict';

angular.module('bahmni.registration')
    .controller('CagRegisterController',['$rootScope', '$scope', '$location', '$window', 'spinner', 'patientService', 'appService',
    'messagingService', '$translate', '$filter', '$http', '$stateParams',
        function ($rootScope, $scope, $location, $window, spinner, patientService, appService, messagingService, $translate, $filter, $http, $stateParams) {
            
            var uuid = $stateParams.cagUuid;
            var apiUrl = 'https://192.168.33.10/openmrs/ws/rest/v1/cag/'+uuid;
            
            $scope.fetchCag = function(url) {
                $http.get(apiUrl)
                .then(function(response) {
                    // Handle the successful response here
                    console.log('API Response:', response);
                    $scope.cag = response.data;
                })
                .catch(function(error) {
                    // Handle any errors that occurred during the request
                    console.error('API Error:', error);
                });
            }
            $scope.fetchCag(apiUrl);
            

        }
    ]);