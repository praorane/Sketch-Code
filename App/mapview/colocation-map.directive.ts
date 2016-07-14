/// <reference path="../datamodel/data-model.service.ts" />
/// <reference path="../defs/service-objects.ts" />
// Copyright (c) Microsoft Corporation. All rights reserved
//  map-view.controller.ts
//  The implementation of SketchSvg app module

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../utilities/device-helper.ts" />

namespace SketchSvg {
    'use strict';

    export enum SelectionBehaviorState {
        started,
        dragging,
        ended
    }

    export interface ISelectionInfo {
        state: SelectionBehaviorState;
        rect: IRect;
    }

    export interface IMapControllerScope extends angular.IScope {
        mapController: MapController;
    }

    interface IColocationMapAttributes extends angular.IAttributes {
        templatePath: string;
    }

    export class ColocationMap implements angular.IDirective {
        public restrict = 'E';
        public scope = {
            isSelectionModeEnabled: '<',    // One-way from the parent
            isInSelectionMode: '=',
            initializeOverlayCallback: '&'
        };

        public controller = 'MapController';
        public controllerAs = 'mapController';
        public bindToController = true;

        constructor(private $compile: angular.ICompileService, private $templateCache: angular.ITemplateCacheService) {
        }

        public link: angular.IDirectiveLinkFn = (
            scope: angular.IScope,
            element: angular.IAugmentedJQuery,
            attrs: IColocationMapAttributes) => {
            if (attrs.templatePath !== '') {
                // Only append a template when its path is valid.
                var html = this.$templateCache.get(attrs.templatePath)
                var template = angular.element(html);
                element.append(template);
                this.$compile(template)(scope);
            }
        }
    }

    export class MapController {
        public zoomLevel: number;
        public deviceTemplate: string;
        public coolAisleTemplate: string;
        public colo: ColoData;
        public lstDataCentersandColos: any;
        public visibleOverlays: number;
        public isInSelectionMode: boolean;
        public selectionInfo: ISelectionInfo;
        public dcName: string = "DC Name";
        public dcShortName: string;
        public dcColoInfo: IDataCenterAndColoInfo;
        public isSelectionModeEnabled: boolean;
        public initializeOverlayCallback: () => number;

        public static $inject = [
            '$scope', '$rootScope',
            '$compile', '$stateParams',
            '$location', 'dataLoader',
            'dataModelService', 'dataLoadingProgress'
            ];

        // TODO: Hard-code this margic number for now (it works for the cell size of 45x45.)
        // Ideally, we need to calculate this length based on tspan styles used in the app.
        public static maxTextLengthInCell = 17;
        public static completedLoadingLayoutData: string = 'completedLoadingLayoutData';
        public static g_zoomChangeRate: number = 1.1;

        private _panningTracker: EventTracker;
        private _selectionTracker: EventTracker;
        private _handlerReleaser: HandlerReleaser;
        private _isPanningMode: boolean = true;
        private _storedIsInSelectionMode: boolean;

        public get isLoadingDataCenterCatalog() {
            return (this.dataLoadingProgress.state & DataLoadingState.DataCenterCatalog) != 0;
        }

        public get isLoadingMapData() {
            return (this.dataLoadingProgress.state &
                (DataLoadingState.TileStatus | DataLoadingState.Power)) != 0;
        }

        public get currentColo(): IColocation {
            var retColo = null;
            var vm = this;

            if (vm.dcColoInfo) {
                var currentColoId = this.dataModelService.currentColoId;
                for (var i = 0; i < vm.dcColoInfo.Colocations.length; i++) {
                    if (currentColoId === vm.dcColoInfo.Colocations[i].Id) {
                        retColo = vm.dcColoInfo.Colocations[i];
                        break;
                    }
                }
            }
            return retColo;
        }

        /// <summary>Implements MapController</summary>
        /// <param name="$scope" type="Object">$scope</param>
        /// <param name="$rootScope" type="Object">$rootScope</param>
        /// <param name="$compile" type="Object">$compile</param>
        /// <param name="dataLoader" type="Object">dataLoader</param>
        constructor(
            private $scope: angular.IScope,
            private $rootScope: angular.IRootScopeService,
            private $compile: angular.ICompileService,
            private $stateParams: angular.ui.IStateParamsService,
            private $location: angular.ILocationService,
            private dataLoader: DataLoader,
            private dataModelService: DataModelService,
            private dataLoadingProgress: DataLoadingProgress
        ) {

            var vm = this;
            vm.zoomLevel = 1;
            vm.deviceTemplate = 'deviceLayoutTemplate.html';
            vm.coolAisleTemplate = 'coolAisleTemplate.html';

            if (vm.initializeOverlayCallback) {
                vm.visibleOverlays = vm.initializeOverlayCallback();
            } else {
                // By default, only turn on the network devices overlay
                vm.visibleOverlays = MapOverlays.deviceTiles;
            }

            this._processRoutingParameters(vm, this.$stateParams);

            this._handlerReleaser = new HandlerReleaser($scope);

            this._handlerReleaser.register(
                $rootScope.$on(AppCommand.selectColo, (event, selectedColo) => {
                    this._resetCurrentMapView();
                    if (angular.isDefined(selectedColo)) {
                        this._loadColo(vm, selectedColo);
                    }
                })
            );

            this._handlerReleaser.register(
                $rootScope.$on(AppCommand.powerView, (event, eventArg) => {
                    vm.visibleOverlays &= ~MapOverlays.reservationDemands;
                    vm.visibleOverlays |= MapOverlays.power;
                })
            );

            this._handlerReleaser.register(
                $scope.$on(AppCommand.coolingFilter, (event, eventArg) => {
                    if (eventArg.isChecked) {
                        vm.visibleOverlays |= MapOverlays.coldAisle;
                    } else {
                        vm.visibleOverlays &= ~MapOverlays.coldAisle;
                    }
                })
            );

            this._handlerReleaser.register(
                $scope.$on(AppCommand.propertyGroupFilter, (event, eventArg) => {
                    if (eventArg.isChecked) {
                        vm.visibleOverlays |= MapOverlays.propertyGroups;
                    } else {
                        vm.visibleOverlays &= ~MapOverlays.propertyGroups;
                    }
                })
            );

            this._handlerReleaser.register(
                $scope.$on(AppCommand.reservationsView, (event, eventArg) => {
                    vm.visibleOverlays |= MapOverlays.reservationDemands;
                    vm.visibleOverlays &= ~MapOverlays.power;
                })
            );

            this._handlerReleaser.register(
                $scope.$on(AppCommand.powerView, (event, eventArg) => {
                    vm.visibleOverlays &= ~MapOverlays.reservationDemands;
                    vm.visibleOverlays |= MapOverlays.power;
                })
            );

            this._handlerReleaser.register(
                $scope.$on(AppCommand.tileSelectionModeChange, (event) => {
                    this.isInSelectionMode = !this.isInSelectionMode;
                    this._refreshBehaviors();
                })
            );

            this._handlerReleaser.register(
                $scope.$watch('mapController.isSelectionModeEnabled', (newValue: boolean, oldValue: boolean) => {
                    this._refreshBehaviors();
                })
            );
        }

        private _processRoutingParameters(vm: MapController, stateParams: any) {
            // Populate fields for the Portal View
            var coloId = stateParams.coloId;
            var dcId = stateParams.dcId;

            if (typeof (coloId) === 'string' && coloId.length !== 0) { // we have a route parameter, load the colo
                this.dataLoadingProgress.start(DataLoadingState.DataCenterCatalog);
                this.colo = null;
                vm.dataModelService.getDataCenterCatalogAsync()
                    .then((catalog: DataCenterCatalog) => {
                        var dcInfo = catalog.getDcInfoFromColoId(coloId);
                        this.dataLoadingProgress.end(DataLoadingState.DataCenterCatalog);
                        vm._loadColoHelper(vm, coloId, dcInfo.Id);
                        vm.dcColoInfo = dcInfo;
                    });
            }

            if (typeof (dcId) === 'string' && dcId !== 0) {
                this.dataLoadingProgress.start(DataLoadingState.DataCenterCatalog);
                vm.dataLoader.getDataCenterCatalogByDcIdAsync(parseInt(dcId))
                    .then((dcInfo: IDataCenterAndColoInfo) => {
                    this.dataLoadingProgress.end(DataLoadingState.DataCenterCatalog);
                    vm.dcColoInfo = dcInfo;
                    // load the first colocation
                    if (dcInfo.Colocations.length) {
                        vm.$location.path(`/colocation/${dcInfo.Colocations[0].Id}/true`); // reroute to the URL for the first colocation. Let existing routing logic do work for you
                    }
                });
            }
        }

        public onInitiaizeLayoutView()
            : IInitialLayoutOptions {
            return {
                tileXSize: 40,
                tileYSize: 30,
                xMarginForYLabels: 45,
                yMarginForXLabels: 45,
            };
        }

        public onSelectionCommitted(tileSelection: Array<ITileRect>) {
            this.dataModelService.selection.racks = tileSelection;
            this.$rootScope.$broadcast(AppCommand.tileSelectionChanged);
        }

        public setMousePanningCallback(
            element: angular.IAugmentedJQuery,
            scrollCallback: Function) {
            if (this._panningTracker) {
                this._panningTracker.dispose();
            }
            if (this._selectionTracker) {
                this._selectionTracker.dispose();
            }

            this._panningTracker = BehaviorBase.createPanningTracker(element, scrollCallback);

            this._selectionTracker = BehaviorBase.createSelectionTracker(element, this);
            this._refreshBehaviors();
        }

        // ISelectCallback
        public shouldActivate() {
            return this.isSelectionModeEnabled;
        }

        public onSelectStart(rect: IRect, autoActivated: boolean) {
            this.$scope.$apply((scope: IMapControllerScope) => {
                if (autoActivated) {
                    // Save the current isInSelectionMode 
                    // before activating the selection mode
                    this._storedIsInSelectionMode = this.isInSelectionMode;
                    this.isInSelectionMode = true;
                }

                scope.mapController.selectionInfo = {
                    state: SelectionBehaviorState.started,
                    rect: rect
                };
            });
        }

        public onSelectEnd(rect: IRect, autoActivated: boolean) {
            this.$scope.$apply((scope: IMapControllerScope) => {
                if (autoActivated) {
                    // Restore the previous value
                    this.isInSelectionMode = this._storedIsInSelectionMode;
                }
                scope.mapController.selectionInfo = {
                    state: SelectionBehaviorState.ended,
                    rect: rect
                };
            });
        }

        public onSelecting(rect: IRect, autoActivated: boolean) {
            this.$scope.$apply((scope: IMapControllerScope) => {
                scope.mapController.selectionInfo = {
                    state: SelectionBehaviorState.dragging,
                    rect: rect
                };
            });
        }

        private _loadColoHelper(vm: MapController, coloId: string, dcId: string) {
            this.dataLoadingProgress.start(DataLoadingState.TileStatus);
            this.dataModelService.currentColoId = coloId;
            this.dataModelService.currentDataCenterId = dcId;
            this.dataModelService.getTilesAsync(coloId)
                .then((coloData) => {
                    this.dataLoadingProgress.end(DataLoadingState.TileStatus);
                    vm.colo = coloData;
                    // We need to queue up the completedLoadingLayoutData event,
                    // otherwise angular may not deliver the event to our
                    // listener in MapViewComponent while being in the middle
                    // of the $digest cycle.
                    this.$scope.$applyAsync((scope: angular.IScope) => {
                        scope.$broadcast(MapController.completedLoadingLayoutData);
                    });
                }, (error) => {
                    this.dataLoadingProgress.end(DataLoadingState.TileStatus);
                });
        }

        private _loadColo(vm: MapController, colo: IColocation) {
            /// <summary>
            ///     Loads a given colo
            /// </summary>
            /// <param name="vm" type="MapController">ViewModel object</param>
            /// <param name="colo" type="any">colo object</param>
            var coloId = colo.Id;
            var dcId = colo.parentId;
            this._loadColoHelper(vm, coloId, dcId);
        }

        private _resetCurrentMapView() {
            /// <summary>Resets the current layout-view directive</summary>

            // To remove the current layout-view directive, we broadcast an event
            // downwards to child scopes. the exact layout-view will remove itself from
            // the DOM tree in its listener.
            this.$scope.$broadcast('destroymapview');
        }

        private _refreshBehaviors() {
            this._isPanningMode = !this.isInSelectionMode || !this.isSelectionModeEnabled;
            if (this._isPanningMode) {
                if (this._selectionTracker) {
                    this._selectionTracker.disable();
                    this._panningTracker.enable();
                }
            } else {
                if (this._selectionTracker) {
                    this._selectionTracker.enable();
                    this._panningTracker.disable();
                }
            }

        }
    }
}
