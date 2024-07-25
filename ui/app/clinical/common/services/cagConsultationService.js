'use strict';

angular.module('bahmni.clinical')
    .service('cagConsultationService', ['$http', '$q', 'appService','patientService', function ($http, $q, appService,patientService) {
        // use this service to create all the necessary cag encounter parameters 
        var cagEncounter = {};
         
    
        var getCagId = function(patientUuid){

        }

        this.saveCageEncounter = function(){

        }
        
        this.getCagPatient = function(){ 

                    var patientUuid =  $scope.patient.uuid; 
                    
                    appService.getCagPatient(patientUuid)
                    .then(function(response){
                        if(response.status == 200){
                            
                            let availableCagId = response.data.cagId;
                            var allCags = appService.getAllCags();        
                            allCags.then(function(response){
                                if(response.status == 200){
                                    let availableCagDetails = response.data.results;
                                    availableCagDetails.forEach(function(cag){

                                    if(availableCagId == cag.id){
                                        var getCagBelongingToPatient = appService.getCAG(cag.uuid);
                                        getCagBelongingToPatient.then(function(res){
                                            
                                            if(res.status == 200){
                                            // console.log("Final Cag patient details : ",res);
                                            // console.log(res.data.cagPatientList);
                                        }else{
                                            // console.log("An error occured please check you query");
                                        }
                                        }).catch(function(error){
                                            console.error("Error : ",error);
                                        });
                                    }                                                                      
                                });
                                }else{
                                    // console.log("Resource was not found");
                                }
                            }).catch(function(error){
                                console.error("Error : ",error);
                            });
                        }else{
                            // console.log("Patient is not in any cag");
                        }
                    }).catch(function(error){
                        console.error("Error : ",error);
                    });
        }
        }]);
        