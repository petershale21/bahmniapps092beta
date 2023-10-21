'use strict';

angular.module('bahmni.registration')
    .controller('CagRegisterController',['$rootScope', '$scope', '$location', '$window', 'spinner','ngDialog', 'patientAttributeService', 'appService',
    'messagingService', '$translate', '$filter', '$http', '$stateParams','addressHierarchyService', 'patientService', '$timeout',
        function ($rootScope, $scope, $location, $window, spinner, ngDialog, patientAttributeService, appService, messagingService, $translate, $filter, $http, $stateParams,addressHierarchyService,patientService,$timeout) {
            $scope.isSubmitting = false;
            $scope.patientlist=[];
            // $scope.cagMembers=[];
            $scope.district="";
            $scope.constituency="";
            $scope.village="";
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
                $scope.isSubmitting = true;
                $scope.cagData={
                    "name": $scope.cag.name,
                    "description": $scope.cag.description,
                    "constituency": $scope.constituency,
                    "village": $scope.village,
                    "district": $scope.district+""
                }
                console.log(($scope.cagData));
                var apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag';
                if($location.path!="/cag/new"){
                    apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag/'+$scope.uuid;
                    console.log(apiUrl);
                }

                $http({
                    url: apiUrl,
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    data: angular.toJson($scope.cagData)
                }).then(function(response){
                    console.log(response);
                    if(response.status==200 || response.status==201){
                        $location.url('/cag/'+response.data.uuid);
                        messagingService.showMessage('info', 'Saved');
                    }
                    $scope.isSubmitting = false;
                })
                
            }

            
            $scope.clearAddressResults = function() {
                $timeout(function() {
                    if($scope.village!='' && $scope.district!='' && $scope.constituency!='')
                    $scope.addressResults = [];
                }, 500);
            };

            $scope.clearPatientResults = function () {
                $timeout(function() {$scope.patientResults = [];}, 500);
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

            $scope.addPatientToCag = function(patientTobeAdded, cagListLength){
                console.log(cagListLength);
                if(JSON.stringify($scope.patientTobeAdded) != '{}' && $scope.searchCagList(patientTobeAdded.uuid,cagListLength)==0){
                    var data={
                        "cagUuid": $scope.uuid,
                        "uuid": patientTobeAdded.uuid
                    }
                    apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cagPatient';
                    $http({
                        url: apiUrl,
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        data: angular.toJson(data)
                    }).then(function(response){
                        console.log(response);
                        if(response.status==200 || response.status==201){
                            $scope.cag.cagPatientList.push($scope.patientTobeAdded);
                            $scope.patientTobeAdded = {};
                            $scope.newPatient = '';
                            messagingService.showMessage('info', 'Patient has been added to CAG');
                        }
                        $scope.isSubmitting = false;
                    })
                    
                }
                else{
                    alert('No selected Patient Or patient already on list...');
                }
            }

            $scope.deletePatientFromCag = function(patientTobeRemoved, patientindex){
                
                apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cagPatient/'+patientTobeRemoved.uuid;
                $http.delete(apiUrl)
                .then(function(response){
                    console.log(response);
                    if(response.status==204){
                        $scope.cag.cagPatientList.splice(patientindex, 1);
                        messagingService.showMessage('info', 'Patient has been removed from CAG');
                    }
                    $scope.isSubmitting = false;
                })
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
            
            if($location.path()!='/cag/new'){
                $scope.uuid = $stateParams.cagUuid;
                console.log("state: "+$stateParams.cagUuid);
                console.log($location.path());
                var apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag/'+$scope.uuid;
                $scope.fetchCag(apiUrl);
            }


            
            
        }
    ]);