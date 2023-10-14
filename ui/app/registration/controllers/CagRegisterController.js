'use strict';

angular.module('bahmni.registration')
    .controller('CagRegisterController',['$rootScope', '$scope', '$location', '$window', 'spinner','ngDialog', 'patientAttributeService', 'appService',
    'messagingService', '$translate', '$filter', '$http', '$stateParams','addressHierarchyService', 'patientService',
        function ($rootScope, $scope, $location, $window, spinner, ngDialog, patientAttributeService, appService, messagingService, $translate, $filter, $http, $stateParams,addressHierarchyService,patientService) {
            $scope.patientlist=[];
            // $scope.cagMembers=[];
            $scope.cag = [];
            $scope.searchAddress = function(fieldName, query){
                var parentUuid = null;
                addressHierarchyService.search(fieldName, query, parentUuid)
                .then(function (response) {
                    // Handle the search results
                    $scope.addressResults = response.data;
                    console.log('Address Results:', $scope.addressResults);
                })
                .catch(function (error) {
                    // Handle errors
                    console.error('Error during address hierarchy search:', error);
                });
            }
    
            $scope.selectAddress = function(selectedAddress){
                $scope.village=selectedAddress.name;
                $scope.constituency=selectedAddress.parent.name;
            }

            
            $scope.fetchCag = function(url) {
                $http.get(apiUrl)
                .then(function(response) {
                    // Handle the successful response here
                    console.log('API Response:', response);
                    $scope.cag = response.data;
                    $scope.village=$scope.cag.village;
                    $scope.constituency=$scope.cag.constituency;
                })
                .catch(function(error) {
                    // Handle any errors that occurred during the request
                    console.error('API Error:', error);
                });
            }
            
            if($location.path()=='/cag/new'){

            }
            else{
                var uuid = $stateParams.cagUuid;
                console.log("state: "+$stateParams.cagUuid);
                console.log($location.path());
                var apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag/'+uuid;
                $scope.fetchCag(apiUrl);
            }


            
            var apiUrl1 = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/patient?q='+$scope.newField;            
            $http.get(apiUrl1)
                .then(function(response) {
                    // Handle the successful response here
                    // console.log('API Response:', response);
                    $scope.patientlist=response.data.results;
                    console.log('API Response:', $scope.patientlist);
                })
                .catch(function(error) {
                    // Handle any errors that occurred during the request
                    console.error('API Error:', error);
                });
        }
    ]);