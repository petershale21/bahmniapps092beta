'use strict';

angular.module('bahmni.registration')
    .controller('CagRegisterController',['$rootScope', '$scope', '$location', '$window', 'spinner','ngDialog', 'patientAttributeService', 'appService',
    'messagingService', '$translate', '$filter', '$http', '$stateParams','addressHierarchyService', 'patientService', '$timeout',
        function ($rootScope, $scope, $location, $window, spinner, ngDialog, patientAttributeService, appService, messagingService, $translate, $filter, $http, $stateParams,addressHierarchyService,patientService,$timeout) {
            $scope.patientlist=[];
            // $scope.cagMembers=[];
            $scope.uuid = "";
            $scope.cag = [];
            $scope.cag.cagPatientList=[];
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
            $scope.showResults=0;
            $scope.selectAddress = function(selectedAddress){
                console.log(selectedAddress)
                $scope.village=selectedAddress.name;
                $scope.constituency=selectedAddress.parent.name;
                $scope.district=selectedAddress.parent.parent.name;
                $scope.addressResults = [];
            }

            $scope.save = function(){
                $scope.cagData={
                    'name': $scope.cag.name,
                    'description': $scope.cag.description,
                    'constituency': $scope.constituency,
                    'village': $scope.village,
                    'district': $scope.district
                }
                var apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag';
                $http({
                    url: apiUrl,
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    data: angular.toJson($scope.cagData,true)
                  }).then(function(response){
                    // alert(response.data);
                    if(response.status==201){
                        $location.url('/cag/'+response.data.uuid);
                    }
                  })
            }
            
            $scope.clearAddressResults = function() {
                $timeout(function() {$scope.addressResults = [];}, 200);
            };

            $scope.clearPatientResults = function () {
                $timeout(function() {$scope.patientResults = [];}, 200);
            }

            $scope.searchPatient = function(fieldPatient){
                var apiUrl1 = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/patient?q='+fieldPatient+'&limit=10';            
                $http.get(apiUrl1)
                .then(function(response) {
                    // Handle the successful response here
                    $scope.patientResults=response.data.results;
                })
                .catch(function(error) {
                    // Handle any errors that occurred during the request
                    alert('API Error:', error);
                });
            }
             
            $scope.patientTobeAdded={};
            
            $scope.selectPatient = function(selectedPatient){
                $scope.patientTobeAdded=selectedPatient;
                $scope.newPatient = $scope.patientTobeAdded.display;
                $scope.patientResults=[];
            }

            $scope.searchCagList = function(key, cagListLength){
                for (let i = 0; i < cagListLength; i++) {
                    if(key == $scope.cag.cagPatientList[i].uuid){
                        return 1
                    }
                }
                return 0;
            }

            $scope.openPatientDashboardInNewTab = function (cagMember) {
                // var personRelatedTo = getPersonRelatedTo(cagMember);
                console.log(getPatientRegistrationUrl(cagMember.uuid));
                $window.open(getPatientRegistrationUrl(cagMember.uuid), '_blank');
            };

            var getPatientRegistrationUrl = function (patientUuid) {
                return '#/patient/' + patientUuid;
            };

            $scope.removeFromCAG = function(index) {
                $scope.cag.cagPatientList.splice(index, 1);
            }

            $scope.addPatientToCag = function(patientTobeAdded, cagListLength){
                console.log(cagListLength);
                if(JSON.stringify($scope.patientTobeAdded) != '{}' && $scope.searchCagList(patientTobeAdded.uuid,cagListLength)==0){
                    $scope.cag.cagPatientList.push($scope.patientTobeAdded);
                    $scope.patientTobeAdded = {};
                    $scope.newPatient = '';
                }
                else{
                    alert('No selected Patient...');
                }
            }
            
            $scope.fetchCag = function(url) {
                $http.get(apiUrl)
                .then(function(response) {
                    // Handle the successful response here
                    console.log('API Response:', response);
                    $scope.cag = response.data;
                    $scope.village=$scope.cag.village;
                    $scope.constituency=$scope.cag.constituency;
                    $scope.district=$scope.cag.district;
                })
                .catch(function(error) {
                    // Handle any errors that occurred during the request
                    console.error('API Error:', error);
                });
            }
            
            if($location.path()=='/cag/new'){

            }
            else{
                $scope.uuid = $stateParams.cagUuid;
                console.log("state: "+$stateParams.cagUuid);
                console.log($location.path());
                var apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag/'+$scope.uuid;
                $scope.fetchCag(apiUrl);
            }


            
            
        }
    ]);