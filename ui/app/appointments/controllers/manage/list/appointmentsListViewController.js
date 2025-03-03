'use strict';

angular.module('bahmni.appointments')
    .controller('AppointmentsListViewController', ['$scope', '$state', '$rootScope', '$translate', '$stateParams', 'spinner',
        'appointmentsService', 'appService', 'appointmentsFilter', 'printer', 'checkinPopUp', 'confirmBox', 'ngDialog', 'messagingService', 'patientService',
        function ($scope, $state, $rootScope, $translate, $stateParams, spinner, appointmentsService, appService,
                  appointmentsFilter, printer, checkinPopUp, confirmBox, ngDialog, messagingService, patientService) {
            $scope.enableSpecialities = appService.getAppDescriptor().getConfigValue('enableSpecialities');
            $scope.enableServiceTypes = appService.getAppDescriptor().getConfigValue('enableServiceTypes');
            $scope.allowedActions = appService.getAppDescriptor().getConfigValue('allowedActions') || [];
            $scope.allowedActionsByStatus = appService.getAppDescriptor().getConfigValue('allowedActionsByStatus') || {};
            $scope.colorsForListView = appService.getAppDescriptor().getConfigValue('colorsForListView') || {};
            $scope.manageAppointmentPrivilege = Bahmni.Appointments.Constants.privilegeManageAppointments;
            $scope.searchedPatient = false;
            var oldPatientData = [];
            $scope.$on('filterClosedOpen', function (event, args) {
                $scope.isFilterOpen = args.filterViewStatus;
            });
            $scope.tableInfo = [{heading: 'APPOINTMENT_PATIENT_ID', sortInfo: 'patient.identifier', enable: true},
                {heading: 'APPOINTMENT_FILE_NUMBER', sortInfo: 'patient.identifier', enable: true},
                {heading: 'APPOINTMENT_PATIENT_NAME', sortInfo: 'patient.name', class: true, enable: true},
                {heading: 'APPOINTMENT_PATIENT_AGE', sortInfo: 'age', enable: true},
                {heading: 'APPOINTMENT_PATIENT_SEX', sortInfo: 'gender', enable: true},
                {heading: 'APPOINTMENT_PATIENT_CONTACTS', sortInfo: 'contacts', enable: true},
                {heading: 'APPOINTMENT_PATIENT_VILLAGE', sortInfo: 'contacts', enable: true},
                {heading: 'APPOINTMENT_PROVIDER', sortInfo: 'provider.name', class: true, enable: true},
                {heading: 'APPOINTMENT_SERVICE_SPECIALITY_KEY', sortInfo: 'service.speciality.name', enable: $scope.enableSpecialities},
                {heading: 'APPOINTMENT_SERVICE', sortInfo: 'service.name', class: true, enable: true},
                {heading: 'APPOINTMENT_SERVICE_TYPE_FULL', sortInfo: 'serviceType.name', class: true, enable: $scope.enableServiceTypes},
                {heading: 'APPOINTMENT_STATUS', sortInfo: 'status', enable: true},
                {heading: 'APPOINTMENT_WALK_IN', sortInfo: 'appointmentKind', enable: true},
                {heading: 'APPOINTMENT_SERVICE_LOCATION_KEY', sortInfo: 'location.name', class: true, enable: true},
                {heading: 'APPOINTMENT_ADDITIONAL_INFO', sortInfo: 'additionalInfo', class: true, enable: true},
                {heading: 'APPOINTMENT_CREATE_NOTES', sortInfo: 'comments', enable: true}];
            var init = function () {
                $scope.searchedPatient = $stateParams.isSearchEnabled && $stateParams.patient;
                $scope.startDate = $stateParams.viewDate || moment().startOf('day').toDate();
                $scope.isFilterOpen = $stateParams.isFilterOpen;
            };
            //Getting Extra Patient Atributes for Appointment List View
            $scope.getPatientAtribute = function(patientAttributeType, patientObj){
                
                patientObj.attributes.forEach(attribute =>{
                   //console.log(attribute.attributeType.display.concat(": ", attribute.value))
                   if(attribute.attributeType.display == patientAttributeType){    
                    return attribute.value;
                   }
                  
                })

            };

            $scope.getAppointmentsForDate = function (viewDate) {
                $stateParams.viewDate = viewDate;
                $scope.selectedAppointment = undefined;
                var params = {forDate: viewDate};
                $scope.$on('$stateChangeStart', function (event, toState, toParams) {
                    if (toState.tabName == 'calendar') {
                        toParams.doFetchAppointmentsData = false;
                    }
                });
                if ($state.params.doFetchAppointmentsData) {
                    spinner.forPromise(appointmentsService.getAllAppointments(params).then(function (response) {
                        $scope.appointments = response.data;
                        $scope.filteredAppointments = appointmentsFilter($scope.appointments, $stateParams.filterParams);
                        //Adding Sex And Gender to appointment objects
                        $scope.filteredAppointments.forEach(appointment => {
                            appService.getPatient(appointment.patient.uuid).then(client => {                                
                                var contact;
                         
                                
                                // console.log(client.data.person.addresses[0].cityVillage)
                               
                                client.data.person.attributes.forEach(attribute =>{
                                    //console.log(attribute.attributeType.display.concat(": ", attribute.value))
                                    if(attribute.attributeType.display == "primaryContact"){    
                                     contact = attribute.value;
                                    }
                                   
                                })


                                Object.assign(appointment,{'contacts': contact })
                                Object.assign(appointment,{'village': client.data.person.addresses[0].cityVillage })
                                Object.assign(appointment,{'age': client.data.person.age})
                                Object.assign(appointment,{'gender': client.data.person.gender})

                                
                               });
                        
                              
                            })
                            

                        
                        $rootScope.appointmentsData = $scope.filteredAppointments;
                       
                        $scope.filteredAppointments.forEach(appointment => {
                            patientService.getPatient(appointment.patient.uuid).then(patientAppointment => {
                                patientAppointment.data.identifiers.forEach(extraId => {
                                    if (extraId.identifierType.display == 'File Number') {
                                        Object.assign(appointment, { 'fileNumber': extraId.identifier })
                                    }
                                });
                            });

                        });
                    }));
                } else {
                    $scope.filteredAppointments = appointmentsFilter($state.params.appointmentsData, $stateParams.filterParams);
                    $state.params.doFetchAppointmentsData = true;
                }
            };

            $scope.displaySearchedPatient = function (appointments) {
                oldPatientData = $scope.filteredAppointments;
                $scope.filteredAppointments = appointments.map(function (appointmet) {
                    appointmet.date = appointmet.startDateTime;
                    return appointmet;
                });
                $scope.searchedPatient = true;
                $stateParams.isFilterOpen = false;
                $scope.isFilterOpen = false;
                $stateParams.isSearchEnabled = true;
            };

            $scope.hasNoAppointments = function () {
                return _.isEmpty($scope.filteredAppointments);
            };

            $scope.goBackToPreviousView = function () {
                $scope.searchedPatient = false;
                $scope.filteredAppointments = oldPatientData;
                $stateParams.isFilterOpen = true;
                $scope.isFilterOpen = true;
                $stateParams.isSearchEnabled = false;
            };

            $scope.isSelected = function (appointment) {
                return $scope.selectedAppointment === appointment;
            };

            $scope.select = function (appointment) {
                if ($scope.isSelected(appointment)) {
                    $scope.selectedAppointment = undefined;
                    return;
                }
                $scope.selectedAppointment = appointment;
            };

            $scope.isWalkIn = function (appointmentType) {
                return appointmentType === 'WalkIn' ? 'Yes' : 'No';
            };

            $scope.editAppointment = function () {
                var params = $stateParams;
                params.uuid = $scope.selectedAppointment.uuid;
                $state.go('home.manage.appointments.list.edit', params);
            };

            $scope.checkinAppointment = function () {
                var scope = $rootScope.$new();
                scope.message = $translate.instant('APPOINTMENT_STATUS_CHANGE_CONFIRM_MESSAGE', {
                    toStatus: 'CheckedIn'
                });
                scope.action = _.partial(changeStatus, 'CheckedIn', _);
                checkinPopUp({
                    scope: scope,
                    className: "ngdialog-theme-default app-dialog-container"
                });
            };

            $scope.$watch(function () {
                return $stateParams.filterParams;
            }, function (newValue, oldValue) {
                if (newValue !== oldValue) {
                    $scope.filteredAppointments = appointmentsFilter($scope.appointments || $state.params.appointmentsData, $stateParams.filterParams);
                }
            }, true);

            $scope.sortAppointmentsBy = function (sortColumn) {
                if (sortColumn === 'additionalInfo') {
                    $scope.filteredAppointments = $scope.filteredAppointments.map(function (appointment) {
                        appointment.additionalInformation = $scope.display(_.get(appointment, sortColumn));
                        return appointment;
                    });
                    sortColumn = "additionalInformation";
                }
                var emptyObjects = _.filter($scope.filteredAppointments, function (appointment) {
                    return !_.property(sortColumn)(appointment);
                });
                var nonEmptyObjects = _.difference($scope.filteredAppointments, emptyObjects);
                var sortedNonEmptyObjects = _.sortBy(nonEmptyObjects, function (appointment) {
                    if (angular.isNumber(_.get(appointment, sortColumn))) {
                        return _.get(appointment, sortColumn);
                    }
                    return _.get(appointment, sortColumn).toLowerCase();
                });
                if ($scope.reverseSort) {
                    sortedNonEmptyObjects.reverse();
                }
                $scope.filteredAppointments = sortedNonEmptyObjects.concat(emptyObjects);
                $scope.sortColumn = sortColumn;
                $scope.reverseSort = !$scope.reverseSort;
            };

            $scope.printPage = function () {
                var printTemplateUrl = appService.getAppDescriptor().getConfigValue("printListViewTemplateUrl") || 'views/manage/list/listView.html';
                printer.print(printTemplateUrl, {
                    searchedPatient: $scope.searchedPatient,
                    filteredAppointments: $scope.filteredAppointments,
                    startDate: $stateParams.viewDate,
                    enableServiceTypes: $scope.enableServiceTypes,
                    enableSpecialities: $scope.enableSpecialities
                });
            };

            $scope.undoCheckIn = function () {
                var undoCheckIn = function (closeConfirmBox) {
                    return appointmentsService.undoCheckIn($scope.selectedAppointment.uuid).then(function (response) {
                        ngDialog.close();
                        $scope.selectedAppointment.status = response.data.status;
                        var message = $translate.instant('APPOINTMENT_STATUS_CHANGE_SUCCESS_MESSAGE', {
                            toStatus: response.data.status
                        });
                        closeConfirmBox();
                        messagingService.showMessage('info', message);
                    });
                };

                var scope = {};
                scope.message = $translate.instant('APPOINTMENT_UNDO_CHECKIN_CONFIRM_MESSAGE');
                scope.yes = undoCheckIn;
                showPopUp(scope);
            };

            var changeStatus = function (toStatus, onDate, closeConfirmBox) {
                var message = $translate.instant('APPOINTMENT_STATUS_CHANGE_SUCCESS_MESSAGE', {
                    toStatus: toStatus
                });
                return appointmentsService.changeStatus($scope.selectedAppointment.uuid, toStatus, onDate).then(function (response) {
                    ngDialog.close();
                    $scope.selectedAppointment.status = response.data.status;
                    closeConfirmBox();
                    messagingService.showMessage('info', message);
                });
            };

            $scope.confirmAction = function (toStatus) {
                var scope = {};
                scope.message = $translate.instant('APPOINTMENT_STATUS_CHANGE_CONFIRM_MESSAGE', {
                    toStatus: toStatus
                });
                scope.yes = _.partial(changeStatus, toStatus, undefined, _);
                showPopUp(scope);
            };

            $scope.display = function (jsonObj) {
                jsonObj = _.mapKeys(jsonObj, function (value, key) {
                    return $translate.instant(key);
                });
                return JSON.stringify(jsonObj || '').replace(/[{\"}]/g, "").replace(/[,]/g, ",\t");
            };

            var showPopUp = function (popUpScope) {
                popUpScope.no = function (closeConfirmBox) {
                    closeConfirmBox();
                };
                confirmBox({
                    scope: popUpScope,
                    actions: [{name: 'yes', display: 'YES_KEY'}, {name: 'no', display: 'NO_KEY'}],
                    className: "ngdialog-theme-default"
                });
            };

            $scope.isAllowedAction = function (action) {
                return _.includes($scope.allowedActions, action);
            };

            $scope.isValidAction = function (action) {
                if (!$scope.selectedAppointment) {
                    return false;
                }
                var status = $scope.selectedAppointment.status;
                var allowedActions = $scope.allowedActionsByStatus.hasOwnProperty(status) ? $scope.allowedActionsByStatus[status] : [];
                return _.includes(allowedActions, action);
            };

            init();
        }]);
