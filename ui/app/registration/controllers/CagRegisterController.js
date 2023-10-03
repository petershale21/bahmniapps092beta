'use strict';

angular.module('bahmni.registration')
    .controller('CagRegisterController',['$rootScope', '$scope', '$location', '$window', 'spinner', 'patientService', 'appService',
    'messagingService', '$translate', '$filter', '$http', '$stateParams',
        function ($rootScope, $scope, $location, $window, spinner, patientService, appService, messagingService, $translate, $filter, $http, $stateParams) {
            
            var uuid = $stateParams.cagUuid;
            var apiUrl = 'https://192.168.56.100/openmrs/ws/rest/v1/cag/'+uuid;

            $scope.addressHierarchyConfigs = appService.getAppDescriptor().getConfigValue("addressHierarchy");
            console.log($scope.addressLevels);
            var init = function () {
                // $scope.cag = patient.create();
                // prepopulateDefaultsInFields();
                // expandSectionsWithDefaultValue();
                // $scope.patientLoaded = true;
            };

            init();

            var prepopulateFields = function () {
                var fieldsToPopulate = appService.getAppDescriptor().getConfigValue("prepopulateFields");
                if (fieldsToPopulate) {
                    _.each(fieldsToPopulate, function (field) {
                        var addressLevel = _.find($scope.addressLevels, function (level) {
                            return level.name === field;
                        });
                        if (addressLevel) {
                            $scope.cag.address[addressLevel.addressField] = $rootScope.loggedInLocation[addressLevel.addressField];
                        }
                    });
                }
            };
            prepopulateFields();
            
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