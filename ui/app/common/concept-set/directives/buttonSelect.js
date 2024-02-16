'use strict';

angular.module('bahmni.common.conceptSet')
    .directive('buttonSelect', function ($rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                observation: '=',
                abnormalObs: '=?'
            },

            link: function (scope, element, attrs) {
                if (attrs.dirtyCheckFlag) {
                    scope.hasDirtyFlag = true;
                }
            },
            controller: function ($scope) {
                $scope.isSet = function (answer) {
                    return $scope.observation.hasValueOf(answer);
                };

                $scope.select = function (answer) {
                    //setting cag present member 'type of patient' to ART Patient if Treatment Buddy selected on options
                    if($rootScope.isCagPresentMemberVisit.activeCagVisits.length>0 && answer.uuid == "0f880c52-3ced-43ac-a79b-07a2740ae428" && answer==$scope.observation.possibleAnswers[0]){
                        answer=$scope.observation.possibleAnswers[1];
                    }
                    //------end--------

                    
                    $scope.observation.toggleSelection(answer);
                    if ($scope.$parent.observation && typeof $scope.$parent.observation.onValueChanged == 'function') {
                        $scope.$parent.observation.onValueChanged();
                    }
                    $scope.$parent.handleUpdate();
                };

                //check if obs is for present Cag member

                $scope.getAnswerDisplayName = function (answer) {
                    var shortName = answer.names ? _.first(answer.names.filter(function (name) {
                        return name.conceptNameType === 'SHORT';
                    })) : null;
                    return shortName ? shortName.name : answer.displayString;
                };
            },
            templateUrl: '../common/concept-set/views/buttonSelect.html'
        };
    });
