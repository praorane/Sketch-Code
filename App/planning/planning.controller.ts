//  Copyright (c) Microsoft Corporation. All rights reserved
//  planning.controller.ts
//  Controller at the application level. 

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../defs/common-types.d.ts" />
/// <reference path="../utilities/utilities.ts" />
/// <reference path="../datamodel/data-load-state.service.ts" />
/// <reference path="../datamodel/data-model.service.ts" />
/// <reference path="../mapview/layout-view.directive.ts" />
/// <reference path="../services/notification.service.ts" />

namespace SketchSvg {
    'use strict';

    export interface ReservationBasicInfo {
        dcId: string;
        coloId: string;
        groupId: string;
    }

    export interface FeedbackCommonInfo extends ReservationBasicInfo {
        dcName: string;
        coloName: string;
        demandId: string;
        userAlias: string;
        incidentReasons: IncidentReasonsData;
    }

    export class PlanningController {
        public currentView: ICommand;
        public notifications: Array<NotificationMessage>;
        public isReservationDetailViewVisible: boolean = false;
        public isSelectionToggleChecked: boolean = false;

        public get isLoading(): boolean {
            return this._dataLoadingProgress.state != DataLoadingState.None;
        }

        public sharedBlades: IBlade[] = [
            {
                title: 'Data Center & Colocation',
                headerBackgroundClass: 'background-dcpicker',
                headerIconBackground: 'headericon-background-dcpicker',
                bladeIcon: '{\'glyph glyph-map\': item.collapsed || !item.collapsed}',
                contentUrl: 'App/dcpicker/shared-blade-metro-data-center.template.html',
                collapsed: false
            },
            {
                title: 'Pending Actions -',
                headerBackgroundClass: 'background-pendingactions',
                headerIconBackground: 'headericon-background-pendingactions',
                bladeIcon: 'item.collapsed ? \'glyph glyph-list\': \'glyph glyph-document\'',
                contentUrl: 'App/pendingtasks/shared-blade-pending-actions.template.html',
                collapsed: true
            },
            {
                title: 'UPS in Colo',
                headerBackgroundClass: 'background-power',
                headerIconBackground: 'headericon-background-power',
                bladeIcon: '{\'glyph glyph-emoji\': item.collapsed || !item.collapsed}',
                contentUrl: 'App/powerdevices/shared-blade-upscolo.template.html',
                collapsed: true
            }
        ];

        public overlayFilters: Array<IFilterCommand> = [
            {
                isChecked: false,
                id: AppCommand.none,    // NYI
                name: 'UPS Power',
                icon: 'glyphicon glyphicon-oil'
            },
            {
                isChecked: false,
                id: AppCommand.coolingFilter,
                name: 'Cooling',
                icon: 'glyphicon glyphicon-tasks'
            },
            {
                isChecked: false,
                id: AppCommand.none,    // NYI
                name: 'Network',
                icon: 'glyphicon glyphicon-blackboard'
            },
            {
                isChecked: false,
                id: AppCommand.propertyGroupFilter,
                name: 'Property Groups',
                icon: 'glyphicon glyphicon-hdd'
            }
        ];

        public views: Array<ICommand> = [
            {
                id: AppCommand.reservationsView,
                name: 'Reservations',
                icon: ''
            },
            {
                id: AppCommand.powerView,
                name: 'Power & Cooling',
                icon: ''
            }
        ];

        public static $inject = [
            '$scope',
            '$rootScope',
            '$uibModal',
            '$state',
            '$q',
            'dataLoadingProgress',
            'dataModelService',
            'adalAuthenticationService'
        ];

        private _handlerReleaser: HandlerReleaser;

        private static _filterToOverlayMap = {
            [AppCommand.coolingFilter]: MapOverlays.coldAisle,
            [AppCommand.propertyGroupFilter]: MapOverlays.propertyGroups,
        };

        constructor(private $scope: angular.IScope,
            private $rootScope: angular.IRootScopeService,
            private $uibModal,
            private $state,
            private $q,
            private _dataLoadingProgress: DataLoadingProgress,
            private _dataModel: DataModelService,
            private _adalAuthenticationService: adal.AdalAuthenticationService
        ) {
            var vm = this;
            // Set the reservations view as the current active view initially
            vm.switchView(vm.views[0].name);

            this._handlerReleaser = new HandlerReleaser(this.$scope);
            this._handlerReleaser.register(
                $scope.$on(AppCommand.enterReservationDetailView, (event, eventArg) => {
                    vm.isReservationDetailViewVisible = true;
                })
            );
            this._handlerReleaser.register(
                $scope.$on(AppCommand.exitReservationDetailView, (event, eventArg) => {
                    vm.isReservationDetailViewVisible = false;
                })
            );
            this._handlerReleaser.register(
                $rootScope.$on(AppCommand.feedbackRequest, (event, eventArg: ReservationBasicInfo) => {
                    this._showFeedbackModal(eventArg);
                })
            );
            this._handlerReleaser.register(
                $scope.$watch('planningControl.isSelectionToggleChecked', (newValue: boolean, oldValue: boolean) => {
                    var toggleButton = $('#seletion-mode-toggle');
                    var isChecked = toggleButton.hasClass('active');
                    if (newValue !== isChecked) {
                        if (newValue) {
                            toggleButton.addClass('active');
                        } else {
                            toggleButton.removeClass('active');
                        }
                    }
                })
            );
        }

        public toggleFilter(toggledFilterName: string) {
            this.overlayFilters.forEach((filter) => {
                if (toggledFilterName === filter.name) {
                    // Flip the toggle state
                    filter.isChecked = !filter.isChecked;
                    this._postCommand(filter.id, { isChecked: filter.isChecked });
                }
            });
        }

        public switchView(selectedViewName: string) {
            var vm = this;
            this.views.forEach((view: ICommand) => {
                // Switch to the selected view if it's not the current view.
                if (selectedViewName === view.name && vm.currentView !== view) {
                    vm.currentView = view;
                    this._postCommand(view.id);
                }
            });
        }

        public toggleSelectionMode($event: BaseJQueryEventObject) {
            this.$rootScope.$broadcast(AppCommand.tileSelectionModeChange);
            // Stop bootstrap handling the event and update the button UI automatically.
            // Instead, we use our AppCommand and the data binding to update the button UI.
            $event.stopPropagation();
        }

        public getInitialViewOverlay()
            : number {
            var overlays = MapOverlays.none;
            if (this.currentView.id === AppCommand.reservationsView) {
                overlays |= MapOverlays.reservationDemands;
            } else if (this.currentView.id === AppCommand.powerView) {
                overlays |= MapOverlays.power;
            }

            for (var i = 0; i < this.overlayFilters.length; i++) {
                var filter = this.overlayFilters[i];
                var filteredOverlay = PlanningController._filterToOverlayMap[filter.id];
                if (filter.isChecked) {
                    overlays |= filteredOverlay;
                } else {
                    overlays &= ~filteredOverlay;
                }
            }

            return overlays;
        }

        private _postCommand(commandId: string, commandArg?: any) {
            if (commandId !== AppCommand.none) {
                if (commandArg) {
                    this.$rootScope.$broadcast(commandId, commandArg);
                } else {
                    this.$rootScope.$broadcast(commandId);
                }
            } else {
                console.error('Post a command with an invalid command id');
            }
        }

        private _showFeedbackModal(basicInfo: ReservationBasicInfo) {
            var navigateBack = () => {
                this.$state.go('^');
            };

            this.$uibModal.open({
                templateUrl: '/App/components/feedback/planning-feedback.template.html',
                controller: 'PlanningFeedbackController',
                controllerAs: 'planningFeedbackController',
                resolve: {
                    commonInfo: (): angular.IPromise<FeedbackCommonInfo> => {
                        var deferred = this.$q.defer();
                        var commonInfo: any = {};
                        commonInfo.userAlias = this._adalAuthenticationService.userInfo.profile.unique_name;

                        var operations = [];

                        this._dataLoadingProgress.start(DataLoadingState.IncientReasons);
                        operations.push(this._dataModel.getIncidentReasonsAsync()
                            .then((incidentReasons: IncidentReasonsData) => {
                                this._dataLoadingProgress.end(DataLoadingState.IncientReasons);
                                commonInfo.incidentReasons = incidentReasons;
                            })
                            .catch((err) => {
                                this._dataLoadingProgress.end(DataLoadingState.IncientReasons);
                            }));

                        if (isNonEmptyString(basicInfo.dcId) || isNonEmptyString(basicInfo.coloId)) {
                            if (isNonEmptyString(basicInfo.coloId)) {
                                commonInfo.coloId = basicInfo.coloId;
                            }

                            if (isNonEmptyString(basicInfo.dcId)) {
                                commonInfo.dcId = basicInfo.dcId;
                            }

                            // Figure out the additional DC and Colo info
                            operations.push(this._dataModel.getDataCenterCatalogAsync()
                                .then((dataCenterCatalog: DataCenterCatalog) => {
                                    var dcInfo;
                                    // If we have a colo Id, try to retrieve all information from it.
                                    if (isNonEmptyString(basicInfo.coloId)) {
                                        var coloInfo = dataCenterCatalog.getColoInfoFromColoId(basicInfo.coloId);
                                        dcInfo = dataCenterCatalog.getDcInfoFromColoId(basicInfo.coloId);
                                        if (coloInfo) {
                                            commonInfo.coloName = coloInfo.Name;
                                            if (dcInfo) {
                                                commonInfo.dcId = dcInfo.Id;
                                                commonInfo.dcName = dcInfo.Name;
                                            }
                                        }
                                    } else if (isNonEmptyString(basicInfo.dcId)) {
                                        // Otherwise, let's check dc info from dcId
                                        dcInfo = dataCenterCatalog.getDcInfoFromDcId(basicInfo.dcId);
                                        if (dcInfo) {
                                            commonInfo.dcName = dcInfo.Name;
                                        }
                                    }
                                }));
                        }

                        if (isNonEmptyString(basicInfo.dcId) && isNonEmptyString(basicInfo.groupId)) {
                            commonInfo.groupId = basicInfo.groupId;
                            // Figure out the additional group info
                            operations.push(this._dataModel.getGroupRequestsAtDataCenterAsync(parseInt(basicInfo.dcId))
                                .then((requests: GroupRequestsAtDataCenter) => {
                                    var groupInfo = requests.getGroupRequestByGroupId(basicInfo.groupId);
                                    if (groupInfo) {
                                        commonInfo.demandId = groupInfo.DemandId.toString();
                                    }
                                }));
                        }

                        this.$q.all(operations)
                            .then((data) => {
                                deferred.resolve(<FeedbackCommonInfo>(commonInfo));
                            })
                            .catch((err) => {
                                // Try pass whatever currently available info through.
                                deferred.resolve(<FeedbackCommonInfo>(commonInfo));
                            });

                        return deferred.promise;
                    }
                },

                bindToController: true
            }).result.then((result: FeedbackResult) => {
                this._submitFeedback(result);
                navigateBack();
            }).catch(() => {
                navigateBack();
            });
        }

        private _submitFeedback(feedback: FeedbackResult) {
            // TODO: Post the feedback back to service
        }
    }

    export interface IBlade {
        title: string;
        headerBackgroundClass: string;
        headerIconBackground: string;
        bladeIcon: string;
        contentUrl: string;
        collapsed: boolean;
    }
}