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

            
            // var visitLocationUuid = $rootScope.visitLocation;
            // var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
            $scope.Height;
        
            console.log(cagService.run());
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
                    "district": $scope.district+"",
                    "cagPatientList": $scope.cag.cagPatientList 
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

            $scope.openPatientRegistrationInNewTab = function (cagMember) {
                // var personRelatedTo = getPersonRelatedTo(cagMember);
                console.log(getPatientRegistrationUrl(cagMember.uuid));
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
                    console.log($scope.cag.cagPatientList[y]);
                }
            }


            $scope.fetchPrevRegimen = function (patientUuids) {
                var todayDate = DateUtil.getDateTimeInSpecifiedFormat(DateUtil.now(),"YYYY-MM-DD");
                console.log("===", patientUuids);
                var deferred = $q.defer();
                observationsService.fetch(patientUuids, [
                    "HIVTC, ART Regimen",
                    "HIVTC, ART start date"
                ], "latest")
                .then(function (response){  
                    // console.log(response,$scope.getMonthDifference(response.data[1].value,todayDate)>=6);
                    if(response.data.length==2 && $scope.getMonthDifference(response.data[1].value,todayDate)>=6){
                        
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


            console.log("===========",$scope.getMonthDifference("2024-01-20","2024-02-20"));
            $scope.addPatientToCag = function(patientTobeAdded, cagListLength){
                console.log(patientTobeAdded);
                
                if(cagListLength==undefined) cagListLength=0;
                if(JSON.stringify($scope.patientTobeAdded) != '{}' && $scope.searchCagList(patientTobeAdded.uuid,cagListLength)==0){
                    $q.all([$scope.fetchPrevRegimen(patientTobeAdded.uuid)]).then(function(hasPrevRegimen) {
                        console.log(hasPrevRegimen);
                        if(hasPrevRegimen[0]){
                            if($location.path()=='/cag/new'){
                                $scope.cag.cagPatientList.push(patientTobeAdded);
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
                                console.log(data);
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
                                        console.log($scope.cag.cagPatientList);
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
                            alert("has no previous regimen given");
                        }
                    })
                    
                    
                    
                    
                }
                else{
                    alert('No selected Patient Or patient already on list...');
                }
            }

            // $scope.deletePatientFromCag = function(patientTobeRemoved, patientindex){
            //     console.log(patientindex);
            //     apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cagPatient/'+patientTobeRemoved.uuid;
            //     $http.delete(apiUrl)
            //     .then(function(response){
            //         console.log(response);
            //         if(response.status==204){
            //             $scope.cag.cagPatientList.splice(patientindex, 1);
            //             messagingService.showMessage('info', 'Patient has been removed from CAG');
            //         }
            //         else{
            //             messagingService.showMessage('error', 'Errror while removing patient from CAG');
            //         }
            //         $scope.isSubmitting = false;
            //     })
            // }
            // $
            var getConceptValues = function () {
                return $q.all([
                    observationsService.fetch("580d4b70-9593-481a-9fe6-3a721fb56184", [
                        "HEIGHT"
                    ],"latest")
                ]);
            };
           console.log(getConceptValues());

            getConceptValues().then(function (result) {
                var heightConcept = _.find(result[0].data, function (observation) {
                    return observation.concept.name === "Height";
                });
                console.log(heightConcept);
                console.log(result);
                try {
                    $scope.Height = result[0].data[0].value;
                } catch (error) {
                    
                }
            });
            var presentPatientUuid="";
            $scope.startVisit = function(cagMember, cagListLength){
                var loginLocation = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName);
                // Generate the current date and time
                console.log($scope);
                console.log($rootScope);
                const currentDate = new Date();
                const dateStarted = currentDate.toISOString().slice(0, 19).replace("T", " ");
                const cagUuid = $scope.cag.uuid;
                presentPatientUuid = cagMember.uuid;
                const locationUuid = loginLocation.uuid;
                const locationName = loginLocation.name;
                // const valueNumeric  = 140;//$scope.Height;
                console.log($scope.Height);
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
                            console.log(visitObjArray);
                        }
                    }
                }
                console.log(absenteesObj);
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
                
                console.log(data);
                apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cagVisit';
                $http({
                    url: apiUrl,
                    method: 'POST',
                    headers: {
                    'Content-Type': 'application/json'
                    },
                    data: angular.toJson(data)
                }).then(function(response){
                    messagingService.showMessage('info', 'Visit Opened ! !');
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
                    console.log('API Response:', response);
                    // Handle the successful response here
                    $scope.cag = response.data;
                    if($scope.cag.cagPatientList!=null){
                        for(let i=0; i<$scope.cag.cagPatientList.length; i++){
                            $scope.cag.cagPatientList[i]["presentMember"] = true;
                            $scope.cag.cagPatientList[i]["absenteeReason"] = "";

                            if($scope.activePatientVisitUUid==""){
                                var CagPatientapiURL=Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cagPatient/'+response.data.cagPatientList[i].uuid;
                                $http.get(CagPatientapiURL)
                                .then(function(response2) {
                                    console.log(response2);
                                    if(response2.data.activeCagVisits.length!=0){
                                        $scope.activevisits = response2.data.activeCagVisits[0].visits;
                                        console.log($scope.activevisits);
                                        $scope.activePatientVisitUUid = response2.data.activeCagVisits[0].attender.uuid;
                                    }
                                })
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
                        console.log($scope.cag.cagPatientList)
                    }
                }
            });
            
            if($location.path()!='/cag/new'){
                $scope.uuid = $stateParams.cagUuid;
                console.log("state: "+$stateParams.cagUuid);
                console.log($location.path());
                var apiUrl = Bahmni.Registration.Constants.baseOpenMRSRESTURL+'/cag/'+$scope.uuid+"?v=full";
                $scope.fetchCag(apiUrl);
            }
            
        }
    ]);