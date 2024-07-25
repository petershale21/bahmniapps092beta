'use strict';

angular.module('bahmni.registration')
    .controller('CagRegisterController',['$rootScope', '$scope', '$location', '$window', 'spinner','ngDialog', 'patientAttributeService', 'appService',
    'messagingService', '$translate', '$filter', '$http', '$stateParams','addressHierarchyService', 'patientService', '$timeout', '$bahmniCookieStore','$q','observationsService','cagService',
        function ($rootScope, $scope, $location, $window, spinner, ngDialog, patientAttributeService, appService, messagingService, $translate, $filter, $http, $stateParams, addressHierarchyService, patientService, $timeout, $bahmniCookieStore,$q,observationsService,cagService) {
            $scope.isSubmitting = false;
            $scope.patientlist=[];
            var DateUtil = Bahmni.Common.Util.DateUtil;
            // $scope.cagMembers=[];
            $scope.district="";
            $scope.constituency="";
            $scope.village="";
            $scope.uuid = "";
            $scope.presentMember=true;
            $scope.selectedPresentMemberUuid="";
            $scope.cag = [];
            $scope.cag.cagPatientList=[];
            $scope.patientThis;// = "5a6f70be-19c2-442e-adf4-89e184abd039";
            var patientListSpinner;
            
            // var visitLocationUuid = $rootScope.visitLocation;
            // var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
            $scope.Height;
        
            $scope.searchAddress = function(fieldName, query){
                var parentUuid = null;
                addressHierarchyService.search(fieldName, query, parentUuid)
                .then(function (response) {
                    // Handle the search results
                    $scope.addressResults = response.data;
                })
                .catch(function (error) {
                    // Handle errors
                    console.error('Error during address hierarchy search:', error);
                });
            }
            $scope.showResults=0;
            $scope.selectAddress = function(selectedAddress){
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
                    "district": $scope.district+"",
                    "cagPatientList": $scope.cag.cagPatientList 
                }
                var apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag';
                if($location.path!="/cag/new"){
                    apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag/'+$scope.uuid;
                }

                $http({
                    url: apiUrl,
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    data: angular.toJson($scope.cagData)
                }).then(function(response){
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
                patientService.searchByNameOrIdentifier(fieldPatient,20).then(function(response) {
                    $scope.patientResults=response.data.pageOfResults;
                });
            }
             
            $scope.patientTobeAdded={};
            
            $scope.selectPatient = function(selectedPatient){
                $scope.patientTobeAdded=selectedPatient;
                $scope.newPatient = $scope.patientTobeAdded.givenName+" "+$scope.patientTobeAdded.familyName+" - "+$scope.patientTobeAdded.identifier+" | ("+$scope.patientTobeAdded.age+" years)";
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

            $scope.openPatientRegistrationInNewTab = function (cagMember) {
                // var personRelatedTo = getPersonRelatedTo(cagMember);
                $window.open(getPatientRegistrationUrl(cagMember.uuid), '_blank');
            };
            var getPatientRegistrationUrl = function (patientUuid) {
                return '#/patient/' + patientUuid;
            };

            // $scope.openPatientVisitInNewTab = function (cagMember) {
            //     // var personRelatedTo = getPersonRelatedTo(cagMember);
            //     console.log(getPatientVisitUrl(cagMember.uuid));
            //     $window.open(getPatientVisitUrl(cagMember.uuid), '_blank');
            // };
            // var getPatientVisitUrl = function (patientUuid) {
            //     return '#/patient/' + patientUuid + '/visit';
            // };

            $scope.show = function(x,y){
                if(x==true){
                    $scope.cag.cagPatientList[y].absenteeReason="";
                }
            }


            $scope.fetchPrevRegimen = function (patientUuids) {
                var todayDate = DateUtil.getDateTimeInSpecifiedFormat(DateUtil.now(),"YYYY-MM-DD");
                var deferred = $q.defer();
                observationsService.fetch(patientUuids, [
                    "HIVTC, ART start date",
                    "HIVTC, ART Regimen"
                ], "latest")
                .then(function (response){  

                    if(response.data.length>1 && response.data[response.data.length-1].concept.name=="HIVTC, ART Regimen" && response.data[0].concept.name=="HIVTC, ART start date" && $scope.getMonthDifference(response.data[0].value,todayDate)>=6){
                        deferred.resolve(true);
                    } 
                    else{
                        deferred.resolve(false);
                    }
                    
                }).catch(function(error){console.log(error)}); 
                return deferred.promise;
            }
            $scope.getMonthDifference = function(startDate, endDate) {
                // const increment = startDate.getMonth() === endDate.getMonth() ? 2 : 1;
                const diff = moment(endDate).diff(moment(startDate), 'months', true);
                return Math.ceil(diff) ;    // this increment is opitional and totally depends on your need.
            }


            $scope.addPatientToCag = function(patientTobeAdded, cagListLength){
                
                if(cagListLength==undefined) cagListLength=0;
                if(JSON.stringify($scope.patientTobeAdded) != '{}' && $scope.searchCagList(patientTobeAdded.uuid,cagListLength)==0){
                    $q.all([$scope.fetchPrevRegimen(patientTobeAdded.uuid)]).then(function(hasPrevRegimen) {
                        if(hasPrevRegimen[0]){
                            var patientTobeAdded2={};
                            patientTobeAdded["display"] = patientTobeAdded.identifier+" - "+patientTobeAdded.givenName+" "+patientTobeAdded.familyName;
                            patientTobeAdded["uuid"] =  patientTobeAdded.uuid;
                            if($location.path()=='/cag/new'){
                                $scope.newCagPatientToBeAdded= {
                                    "uuid": patientTobeAdded.uuid+"",
                                    "display":patientTobeAdded.identifier+" - "+patientTobeAdded.givenName+" "+patientTobeAdded.familyName
                                }
                                $scope.cag.cagPatientList.push($scope.newCagPatientToBeAdded);
                            }
                            else{
                                var data={
                                    "cag": {
                                        "uuid": $scope.uuid+""
                                    },
                                    "patient": {
                                        "uuid": patientTobeAdded.uuid+""
                                    }
        
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
                                    if((response.status==200 || response.status==201) && $scope.cag.cagPatientList!=null){
                                        patientTobeAdded["presentMember"] = true;
                                        patientTobeAdded["absenteeReason"] = "";
                                        $scope.cag.cagPatientList.push(patientTobeAdded);
                                        $scope.patientTobeAdded = {};
                                        $scope.newPatient = '';
                                        messagingService.showMessage('info', 'Patient has been added to CAG');
                                    }
                                    else{
                                        messagingService.showMessage('error', response.error.message);
                                    }
                                    $scope.isSubmitting = false;
                                })
                            }
                        }
                        
                        else{
                            alert("Cannot add patient, patient must have ART Start date and previous regimen filled in previous forms and also ART start date must be 6 or more months ago from today");
                        }
                    })
                    
                    
                    
                    
                }
                else{
                    alert('No selected Patient Or patient already on list...');
                }
                $scope.newPatient="";
            }

            $scope.deletePatientFromCag = function(patientTobeRemoved, patientindex){
                apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cagPatient/'+patientTobeRemoved.uuid;
                $http.delete(apiUrl)
                .then(function(response){
                    if(response.status==204){
                        $scope.cag.cagPatientList.splice(patientindex, 1);
                        messagingService.showMessage('info', 'Patient has been removed from CAG');
                    }
                    else{
                        messagingService.showMessage('error', 'Errror while removing patient from CAG');
                    }
                    $scope.isSubmitting = false;
                })
            }
            // $
            var getConceptValues = function () {
                return $q.all([
                    observationsService.fetch("580d4b70-9593-481a-9fe6-3a721fb56184", [
                        "HEIGHT"
                    ],"latest")
                ]);
            };

            getConceptValues().then(function (result) {
                var heightConcept = _.find(result[0].data, function (observation) {
                    return observation.concept.name === "Height";
                });
                try {
                    $scope.Height = result[0].data[0].value;
                } catch (error) {
                    
                }
            });

            var showSpinner = function (spinnerObj, container) {
                $('.full-screen-spinner').show();
            };
            var hideSpinner = function (spinnerObj, data, container) {
                $('.full-screen-spinner').hide();
            };
            patientListSpinner = showSpinner(spinner, $(".tab-content"));
            hideSpinner(spinner, patientListSpinner, $(".tab-content"));
            // $('.full-screen-spinner').hide();
            var presentPatientUuid="";
            $scope.startVisit = function(cagMember, cagListLength){
                patientListSpinner = showSpinner(spinner, $(".tab-content"));
                var loginLocation = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName);
                // Generate the current date and time
                const currentDate = new Date();
                const dateStarted = currentDate.toISOString().slice(0, 19).replace("T", " ");
                const cagUuid = $scope.cag.uuid;
                presentPatientUuid = cagMember.uuid;
                const locationUuid = loginLocation.uuid;
                const locationName = loginLocation.name;
                // const valueNumeric  = 140;//$scope.Height;
                var visitObjArray = [];
                const absenteesObj = {};
                for(var i = 0; i<$scope.cag.cagPatientList.length; i++){
                    if($scope.cag.cagPatientList[i].presentMember==false){
                        absenteesObj[$scope.cag.cagPatientList[i].uuid] = $scope.cag.cagPatientList[i].absenteeReason;
                    }
                    else{
                        if(cagMember.uuid==$scope.cag.cagPatientList[i].uuid){
                            var presentObj = {
                                "patient": {
                                    "uuid": cagMember.uuid
                                },
                                "visitType": "da0fffe2-a9c9-489a-b9b0-a5405032c465",
                                "location": {
                                    "uuid": locationUuid
                                },
                                "startDatetime": dateStarted,
                                "encounters": [
                                    {
                                        "encounterDatetime": dateStarted,
                                        "encounterType": "81888515-3f10-11e4-adec-0800271c1b75",
                                        "patient": cagMember.uuid,
                                        "location": locationUuid, 
                                        "obs":[
                                            {
                                                "concept": {
                                                    "conceptId": 55,
                                                    "uuid": "84f626d0-3f10-11e4-adec-0800271c1b75"
                                                },
                                                "obsDatetime": dateStarted,
                                                "person": {
                                                    "uuid": cagMember.uuid
                                                },
                                                "location":{
                                                    "uuid": locationUuid
                                                },
                                                "groupMembers": [
                                                    {
                                                        "concept": {
                                                            "conceptId": 4964,
                                                            "uuid": "9b1fa8e6-8209-4fcd-abd2-142887fc83e0"
                                                        },
                                                        "valueCoded": "a3e3fdfe-e03c-401d-a3fd-1c2553fefe53",
                                                        "valueCodedName": "HTC, Patient",
                                                        "obsDatetime": dateStarted,
                                                        "person": {
                                                            "uuid": cagMember.uuid
                                                        },
                                                        "location":{
                                                            "uuid": locationUuid
                                                        }
                                                    },
                                                    // {
                                                    //     "concept": {
                                                    //         "conceptId": 118,
                                                    //         "uuid": "5090AAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                                                    //     },
                                                    //     "valueNumeric": 1000,
                                                    //     "obsDatetime": dateStarted,
                                                    //     "person": {
                                                    //         "uuid": cagMember.uuid
                                                    //     },
                                                    //     "location":{
                                                    //         "uuid": locationUuid
                                                    //     }
                                                    // },
                                                    // {
                                                    //     "concept": {
                                                    //         "conceptId": 119,
                                                    //         "uuid": "5089AAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                                                    //     },
                                                    //     "valueNumeric": 2000,
                                                    //     "obsDatetime": dateStarted,
                                                    //     "person": {
                                                    //         "uuid": cagMember.uuid
                                                    //     },
                                                    //     "location":{
                                                    //         "uuid": locationUuid
                                                    //     }
                                                    // },
                                                    {
                                                        "concept": {
                                                            "conceptId": 3710,
                                                            "uuid": "4a2cec08-4512-4635-b1de-b3b698f56346"
                                                        },
                                                        "valueCoded": "562fee67-96c5-4b80-ba02-ba8805a28693",
                                                        "valueCodedName": "No signs",
                                                        "obsDatetime": dateStarted,
                                                        "person": {
                                                            "uuid": cagMember.uuid
                                                        },
                                                        "location":{
                                                            "uuid": locationUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 128,
                                                            "uuid": "c36e9c8b-3f10-11e4-adec-0800271c1b75"
                                                        },
                                                        "valueNumeric": 120,
                                                        "obsDatetime": dateStarted,
                                                        "person": {
                                                            "uuid": cagMember.uuid
                                                        },
                                                        "location":{
                                                            "uuid": locationUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 131,
                                                            "uuid": "c379aa1d-3f10-11e4-adec-0800271c1b75"
                                                        },
                                                        "valueNumeric": 73,
                                                        "obsDatetime": dateStarted,
                                                        "person": {
                                                            "uuid": cagMember.uuid
                                                        },
                                                        "location":{
                                                            "uuid": locationUuid
                                                        }
                                                    },
                                                    {
                                                        "concept": {
                                                            "conceptId": 2086,
                                                            "uuid": "90f53912-95d5-4b5c-a9eb-81f3f937225e"
                                                        },
                                                        "valueNumeric": 24,
                                                        "obsDatetime": dateStarted,
                                                        "person": {
                                                            "uuid": cagMember.uuid
                                                        },
                                                        "location":{
                                                            "uuid": locationUuid
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            };
                            visitObjArray.push(presentObj);
                        }
                        else{
                            const buddieObj = {
                                "patient": $scope.cag.cagPatientList[i].uuid,
                                "visitType": "da0fffe2-a9c9-489a-b9b0-a5405032c465",
                                "location": locationUuid,
                                "startDatetime": dateStarted,
                                "encounters": [
                                    {
                    
                                        "encounterDatetime": dateStarted,
                                        "encounterType": "81888515-3f10-11e4-adec-0800271c1b75",
                                        "patient": $scope.cag.cagPatientList[i].uuid,
                                        "location": locationUuid,
                                        "obs": [
                                            {
                                                "concept": {
                                                    "conceptId": 55,
                                                    "uuid": "84f626d0-3f10-11e4-adec-0800271c1b75"
                                                },
                                                "obsDatetime": dateStarted,
                                                "person": {
                                                    "uuid": $scope.cag.cagPatientList[i].uuid
                                                },
                                                "location":{
                                                    "uuid": locationUuid
                                                },
                                                "groupMembers": [
                                                    {
                                                        "concept": {
                                                            "conceptId": 4964,
                                                            "uuid": "9b1fa8e6-8209-4fcd-abd2-142887fc83e0"
                                                        },
                                                        "valueCoded": "60c86ea4-5a2d-4d72-8190-32e47d06e0fa",
                                                        "valueCodedName": "HTC, Buddy",
                                                        "obsDatetime": dateStarted,
                                                        "person": {
                                                            "uuid": $scope.cag.cagPatientList[i].uuid
                                                        },
                                                        "location":{
                                                            "uuid": locationUuid
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            };
                            visitObjArray.push(buddieObj);
                        }
                    }
                }
                //const locationName = "Unknown Location";

                // Build the JSON data
                var data = {
                    "cag": {
                        "uuid": cagUuid
                    },
                    "dateStarted": dateStarted,
                    "locationName": loginLocation.name,
                    "attender": {
                        "uuid": cagMember.uuid
                    },
                    "absentees": absenteesObj,
                    "visits": visitObjArray
                }
                
                apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cagVisit';
                $http({
                    url: apiUrl,
                    method: 'POST',
                    headers: {
                    'Content-Type': 'application/json'
                    },
                    data: angular.toJson(data)
                }).then(function(response){
                    hideSpinner(spinner, patientListSpinner, $(".tab-content"));
                    messagingService.showMessage('info', 'CAG Visit Opened ! !');
                    // $window.open(getPatientVisitUrl(cagMember.uuid), '_blank');
                    $location.path('/patient/' + cagMember.uuid + '/visit')
                })
            }

            $scope.enterVisit = function(patientdata, index){
                $location.path('/patient/' + patientdata.uuid + '/visit')
            }

            $scope.activePatientVisitUUid="";
            $scope.activevisits = [];
            $scope.fetchCag = function(url) {
                
                $http.get(apiUrl)
                .then(function(response) {
                    // Handle the successful response here
                    $scope.cag = response.data;
                    if($scope.cag.cagPatientList!=null){
                        for(let i=0; i<$scope.cag.cagPatientList.length; i++){
                            $scope.cag.cagPatientList[i]["presentMember"] = true;
                            $scope.cag.cagPatientList[i]["absenteeReason"] = "";

                            if($scope.activePatientVisitUUid==""){
                                var CagPatientapiURL=Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cagVisit?attenderuuid='+response.data.cagPatientList[i].uuid+'&isactive='+true;
                                $http.get(CagPatientapiURL)
                                .then(function(response2) {
                                    if(response2.data.results){
                                        if(response2.data.results.length!=0){
                                            $scope.activevisits = response2.data.results[0].visits;
                                            $scope.activePatientVisitUUid = response2.data.results[0].attender.uuid;
                                        }
                                    }
                                }).catch(function (error) {
                                    console.log('API Error:', error);
                                });
                            }
                            

                        }
                        
                        
                        $scope.village=$scope.cag.village;
                        $scope.constituency=$scope.cag.constituency;
                        $scope.district=$scope.cag.district;
                    }
                })
                .catch(function(error) {
                    // Handle any errors that occurred during the request
                    console.error('API Error:', error);
                });
            }
            $scope.$watchGroup(['cag.cagPatientList','activevisits'],function(oldV,newV){
                //only when active visit are less than cag member total do we check for missing member visits
                if($scope.activevisits.length<$scope.cag.cagPatientList.length && $scope.activevisits.length!=0){
                    for (let k = 0; k < $scope.cag.cagPatientList.length; k++) {
                        var absentee = false;
                        for (let j = 0; j < $scope.activevisits.length; j++) {                                
                            if($scope.cag.cagPatientList[k].uuid==$scope.activevisits[j].patient.uuid) {
                                absentee = true;
                                // alert(absentee);
                            }  
                        }
                        if(absentee==false){
                            $scope.cag.cagPatientList[k].presentMember=false;
                            $scope.cag.cagPatientList[k].absenteeReason="absent";
                        }
                    }
                }
            });
            
            if($location.path()!='/cag/new'){
                $scope.uuid = $stateParams.cagUuid;
                var apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag/'+$scope.uuid+"?v=full";
                $scope.fetchCag(apiUrl);
            }
            
        }
    ]);