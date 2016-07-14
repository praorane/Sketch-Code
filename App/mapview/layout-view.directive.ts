// Copyright (c) Microsoft Corporation. All rights reserved
//  layout-view.directive.ts
//  The implementation of various map view directives

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../services/reservation-detail.service.ts" />
/// <reference path="../services/rack-detail.service.ts" />
/// <reference path="../datamodel/data-model.service.ts" />
/// <reference path="../services/basic-layout.service.ts" />
/// <reference path="../utilities/utilities.ts" />

module SketchSvg {
    'use strict';

    // Overlay bit flags
    export enum MapOverlays {
        none = 0,
        coldAisle = 0x01,
        deviceTiles = 0x01 << 1,
        propertyGroups = 0x01 << 2,
        reservationDemands = 0x01 << 3,
        power = 0x01 << 4,
    }

    export interface IInitialLayoutOptions {
        tileXSize?: number;
        tileYSize?: number;
        xMarginForYLabels?: number;
        yMarginForXLabels?: number;
        headerHeight?: number;
        footerHeight?: number;
    }

    export class LayoutView implements angular.IDirective {
        public restrict:string = 'E';
        public replace:boolean = true;
        public scope = {
            coloData: '=',
            zoomLevel: '=',
            isLoadingPower: '&',
            visibleOverlays: '=',
            deviceTemplate: '=',
            coolAisleTemplate: '=',
            propertyGroupTemplate: '=',
            preliminaryDemandTemplate: '=',
            finalDemandTemplate: '=',
            selectionInfo: '=',
            initializeLayoutCallback: '&',
            powerTemplate: '=',
        };

        public templateNamespace: string = 'svg';
        public templateUrl = 'App/mapview/layout-view.html';
        public controller = 'LayoutViewController';
        public controllerAs = 'layoutController';
        public bindToController = true;

        constructor() {
        }
    }

    interface ILayoutViewControllerScope extends angular.IScope {
        layoutController: LayoutViewController;
    }

    export class LayoutViewController {
        public guidelinesPath: string;

        public xLabels: string;
        public yLabels: string;
        public yTopLabels: number;
        public yBottomLabels: number;
        public xLeftLabels: number;
        public xRightLabels: number;

        public availableTilesPath: string;
        public reservedTilesPath: string;
        public usedTilesPath: string;
        public errorTilesPath: string;

        public deviceTiles: Array<IRect>;
        public deployedTileRectangles: Array<IRect>;
        public reservedTileRectangles: Array<IRect>;
        public propertyGroups: Array<IPropertyGroupInfo>;
        public preliminaryDemands: Array<IOrderRenderingData>;
        public finalDemands: Array<IOrderRenderingData>;

        public coloData: ColoData;
        public initializeLayoutCallback: () => IInitialLayoutOptions;
        public visibleOverlays: number;
        public zoomLevel: number;

        public coldAislesPath: string;

        public viewHeight: number;
        public viewWidth: number;

        public static $inject = [
            '$scope', '$element', '$timeout', '$q',
            'dataModelService',
            'spaceRendererFactory',
            'powerCoolingRenderFactory',
            'rackDetailRendererFactory',
            'reservationDetailRendererService',
            'dataLoadingProgress'
        ];

        public get isColdAislesVisible(): boolean {
            return (this._visibleOverlays & MapOverlays.coldAisle) !== 0;
        }

        public get isDevicesOverlayVisible(): boolean {
            return (this._visibleOverlays & MapOverlays.deviceTiles) !== 0;
        }

        public get isPropertyGroupsOverlayVisible(): boolean {
            return (this._visibleOverlays & MapOverlays.propertyGroups) !== 0;
        }

        public get isReservationDemandsOverlayVisible(): boolean {
            return (this._visibleOverlays & MapOverlays.reservationDemands) !== 0;
        }

        public get isPowerOverlayVisible(): boolean {
            return (this._visibleOverlays & MapOverlays.power) !== 0;
        }

        public get coloStartX(): string {
            return this.coloData ? this.coloData.data.StartX : undefined;
        }

        public get coloStartY(): number {
            return this.coloData ? parseInt(this.coloData.data.StartY) : undefined;
        }

        public get xDelta(): number {
            return this._xDelta;
        }

        public get yDelta(): number {
            return this._yDelta;
        }

        public get headerHeight(): number {
            return this._headerHeight;
        }

        public get footerHeight(): number {
            return this._footerHeight;
        }

        public get xMargin(): number {
            return this._xMargin;;
        }

        public get yMargin(): number {
            return this._yMargin;;
        }

        public get boundingClientRect(): ClientRect {
            return this.$element[0].getBoundingClientRect();
        }

        private get _renderingCallbacksCount() {
            if (this._callbackCount === -1) {
                this._callbackCount = 0;
                for (var prop in this._renderingCallbacks) {
                    if (this._renderingCallbacks.hasOwnProperty(prop)) {
                        this._callbackCount++;
                    }
                }
            }

            return this._callbackCount;
        }

        private _xDelta: number;
        private _yDelta: number;
        private _xMargin: number;
        private _yMargin: number;
        private _headerHeight: number;
        private _footerHeight: number;
        private _actualViewWidth: number;
        private _actualViewHeight: number;
        private _visibleOverlays: number;
        private _callbackCount: number = -1;
        private _handlerReleaser: HandlerReleaser;

        // Register overlay callbacks
        private _renderingCallbacks: {
            [overlay: number]: (coloTilesData: ColoData,
                coloStartX: string,
                coloStartY: number,
                xDelta: number,
                yDelta: number,
                headerHeight: number,
                footerHeight: number,
                xMargin: number, yMargin: number
            ) => void;
        } =  {
            // Cooling overlay callback
            [MapOverlays.coldAisle]: (coloTilesData: ColoData,
                coloStartX: string,
                coloStartY: number,
                xDelta: number,
                yDelta: number,
                headerHeight: number,
                footerHeight: number,
                xMargin: number, yMargin: number
            ) => {
                this._drawColdAisle(coloTilesData, coloStartX, coloStartY,
                    xDelta, yDelta, headerHeight, footerHeight,
                    xMargin, yMargin);
            },
            // Network device overlay callback
            [MapOverlays.deviceTiles]: (coloTilesData: ColoData,
                coloStartX: string,
                coloStartY: number,
                xDelta: number,
                yDelta: number,
                headerHeight: number,
                footerHeight: number,
                xMargin: number, yMargin: number
            ) => {
                this._drawDeviceTiles(coloTilesData, coloStartX, coloStartY,
                    xDelta, yDelta, headerHeight, footerHeight,
                    xMargin, yMargin);
            },
            // Property group overlay callback
            [MapOverlays.propertyGroups]: (coloTilesData: ColoData,
                coloStartX: string,
                coloStartY: number,
                xDelta: number,
                yDelta: number,
                headerHeight: number,
                footerHeight: number,
                xMargin: number, yMargin: number
            ) => {
                this._drawPropertyGroups(coloTilesData, coloStartX, coloStartY,
                    xDelta, yDelta, headerHeight, footerHeight,
                    xMargin, yMargin);
            },
            // Reservation demands overlay callback
            [MapOverlays.reservationDemands]: (coloTilesData: ColoData,
                coloStartX: string,
                coloStartY: number,
                xDelta: number,
                yDelta: number,
                headerHeight: number,
                footerHeight: number,
                xMargin: number, yMargin: number
            ) => {
                this._drawReservationDemands(coloTilesData, coloStartX, coloStartY,
                    xDelta, yDelta, headerHeight, footerHeight,
                    xMargin, yMargin);
            },
            [MapOverlays.power]: (coloTilesData: ColoData,
                coloStartX: string,
                coloStartY: number,
                xDelta: number,
                yDelta: number,
                headerHeight: number,
                footerHeight: number,
                xMargin: number, yMargin: number
            ) => {
                this._drawRackPower(coloTilesData, coloStartX, coloStartY,
                    xDelta, yDelta, headerHeight, footerHeight,
                    xMargin, yMargin);
            }
        };

        constructor(
            private $scope: ILayoutViewControllerScope,
            private $element: angular.IAugmentedJQuery,
            private $timeout: angular.ITimeoutService,
            private $q: angular.IQService,
            private dataModelService: DataModelService,
            private spaceRendererFactory: SpaceRendererFactory,
            private powerCoolingRenderFactory: PowerCoolingRenderFactory,
            private rackDetailRendererFactory: RackDetailRendererFactory,
            private reservationDetailRendererService: ReservationDetailRendererService,
            private dataLoadingProgress: DataLoadingProgress
        ) {
            var vm = this;
            vm.deviceTiles = [];
            vm.coldAislesPath = '';

            this._visibleOverlays = MapOverlays.none;
            var options: IInitialLayoutOptions = $scope.layoutController.initializeLayoutCallback();
            this._xDelta = options.tileXSize || 30;
            this._yDelta = options.tileYSize || 20;
            this._xMargin = options.xMarginForYLabels || 40;
            this._yMargin = options.yMarginForXLabels || 40;
            this._headerHeight = options.headerHeight || 0;
            this._footerHeight = options.footerHeight || 0;

            var _destroy = function () {
                /// <summary>Removes this directive from the DOM tree</summary>

                $element.remove();
                $scope.$destroy();
            };

            this._handlerReleaser = new HandlerReleaser($scope);
            this._handlerReleaser.register(
                $scope.$watch('layoutController.zoomLevel', (newValue: number, oldValue: number) => {
                    if (newValue !== oldValue) {
                        vm.viewWidth = Math.round(this._actualViewWidth * newValue * 100) / 100;
                        vm.viewHeight = Math.round(this._actualViewHeight * newValue * 100) / 100;
                    }
                })
            );

            this._handlerReleaser.register(
                $scope.$watch('layoutController.coloData', (newValue: ColoData, oldValue: ColoData) => {
                    if (!newValue) {
                        $timeout(() => {
                            _destroy();
                        }, 0);
                        return;
                    }

                    this._renderView($scope.layoutController.visibleOverlays);
                })
            );

            this._handlerReleaser.register(
                $scope.$watch('layoutController.visibleOverlays', (newValue: number, oldValue: number) => {
                    if (this._visibleOverlays === newValue) {
                        return;
                    }

                    var coloTilesData = this.coloData;
                    var coloData = coloTilesData.data;
                    var coloStartY = parseInt(coloData.StartY);
                    var coloStartX = coloData.StartX;

                    this._renderOverlays(newValue,
                        coloTilesData,
                        coloStartX, coloStartY,
                        this._xDelta, this._yDelta,
                        this._headerHeight, this._footerHeight,
                        this._xMargin, this._yMargin);
                })
            );

            this._handlerReleaser.register(
                $scope.$on('destroymapview', () => {
                    // We cannot remove the directive in the event handler.
                    // This is because the scope removal in the handler will make Angular barf.
                    // So we have to delay the removal after angular's broadcasting done.
                    $timeout(() => {
                        _destroy();
                    }, 0);
                })
            );
        }

        private _renderView(showOverlays: number) {
            var vm = this;

            var coloTilesData = this.coloData;
            var coloData = coloTilesData.data;
            var coloStartY = parseInt(coloData.StartY);
            var coloStartX = coloData.StartX;
            var actualViewWidth = 2 * this._xMargin + coloData.ColoXSize * this._xDelta;
            var actualViewHeight = 2 * this._yMargin + coloData.ColoYSize * this._yDelta;
            var activeTileElement;

            // Render the background guidelines and tile coordinate labels
            this.spaceRendererFactory.getBackgroundPathAsync(
                coloStartX, coloStartY,
                coloData.ColoXSize, coloData.ColoYSize,
                this._xDelta, this._yDelta,
                this._headerHeight, this._footerHeight,
                this._xMargin, this._yMargin
            ).then((data: {
                guidelinesPath: string,
                xLabels: string,
                yLabels: string,
                yTopLabels: number,
                yBottomLabels: number,
                xLeftLabels: number,
                xRightLabels: number
            }) => {
                vm.guidelinesPath = data.guidelinesPath;
                vm.xLabels = data.xLabels;
                vm.yLabels = data.yLabels;

                vm.yTopLabels = data.yTopLabels + this._headerHeight + this._yMargin - 3;
                vm.yBottomLabels = data.yBottomLabels + 3;
                vm.xLeftLabels = data.xLeftLabels + this._xMargin - 3;
                vm.xRightLabels = data.xRightLabels + 3;
            });

            // Draw the fixed tiles based on their availability status
            this.spaceRendererFactory.getTileSpacePathAsync(
                coloData.Tiles,
                coloStartX, coloStartY,
                this._xDelta, this._yDelta,
                this._headerHeight, this._footerHeight,
                this._xMargin, this._yMargin
            ).then((data: IRackRenderingData) => {
                vm.availableTilesPath = data.availableTilesPath;
                vm.reservedTilesPath = data.reservedTilesPath;
                vm.usedTilesPath = data.usedTilesPath;
                vm.errorTilesPath = data.errorTilesPath;
            });

            this._renderOverlays(showOverlays,
                coloTilesData,
                coloStartX, coloStartY,
                this._xDelta, this._yDelta,
                this._headerHeight, this._footerHeight,
                this._xMargin, this._yMargin);

            // Set up the initial view size and zoom level.
            this._actualViewWidth = actualViewWidth;
            this._actualViewHeight = actualViewHeight;
            vm.viewWidth = actualViewWidth;
            vm.viewHeight = actualViewHeight;
        }

        private _renderOverlays(
            showOverlays: number,
            coloTilesData: ColoData,
            coloStartX: string,
            coloStartY: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ) {
            // Iterate through all registered rendering callback.
            // Then find out whether we need to turn on or off the overlay
            for (var prop in this._renderingCallbacks) {
                if (this._renderingCallbacks.hasOwnProperty(prop)) {
                    var overlay = parseInt(prop);
                    var previousVisibleFlag = this._visibleOverlays & overlay;
                    var newVisibleFlag = showOverlays & overlay;
                    if (newVisibleFlag !== previousVisibleFlag) {
                        if (newVisibleFlag !== 0) {
                            // Show the overlay
                            this._renderingCallbacks[prop](coloTilesData,
                                coloStartX, coloStartY,
                                this._xDelta, this._yDelta,
                                headerHeight, footerHeight,
                                this._xMargin, this._yMargin);
                            this._visibleOverlays |= overlay;
                        } else {
                            // Hide the overlay
                            this._visibleOverlays &= ~overlay;
                        }
                    }
                }
            }
        }

        private _drawColdAisle(
            coloTilesData: ColoData,
            coloStartX: string,
            coloStartY: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ) {
            var vm = this;
            this.powerCoolingRenderFactory.getColdAislesPathAsync(
                coloTilesData.data.Tiles,
                coloStartX, coloStartY,
                xDelta, yDelta,
                headerHeight, footerHeight,
                xMargin, yMargin
            ).then((data: { coldAislesPath: string }) => {
                vm.coldAislesPath = data.coldAislesPath;
            });
        }

        private _drawDeviceTiles(
            coloTilesData: ColoData,
            coloStartX: string,
            coloStartY: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ) {
            var vm = this;
            vm.deviceTiles = SpaceRendererFactory.getBoundingRectsForRackTiles(
                coloTilesData.networkDeviceTiles,
                coloStartX, coloStartY,
                xDelta, yDelta,
                headerHeight, footerHeight,
                xMargin, yMargin);
        }

        private _drawReservationDemands(
            coloTilesData: ColoData,
            coloStartX: string,
            coloStartY: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ) {
            var vm = this;
            this.reservationDetailRendererService.getReservationGroupsAsync(
                this.dataModelService.currentDataCenterId,
                this.dataModelService.currentColoId,
                coloTilesData,
                coloStartX, coloStartY,
                this._xDelta, this._yDelta,
                this._headerHeight, this._footerHeight,
                this._xMargin, this._yMargin
            ).then((reservationInfo) => {
                vm.preliminaryDemands = reservationInfo.preliminaryDemands;
                vm.finalDemands = reservationInfo.finalDemands;
            });
        }

        private _drawPropertyGroups(
            coloTilesData: ColoData,
            coloStartX: string,
            coloStartY: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ) {
            var vm = this;
            this.rackDetailRendererFactory.getPropertyGroupsAsync(
                coloTilesData.data.Tiles,
                coloStartX, coloStartY,
                this._xDelta, this._yDelta,
                this._headerHeight, this._footerHeight,
                this._xMargin, this._yMargin
            ).then((propertyGroups) => {
                vm.propertyGroups = propertyGroups;
            });
        }

        private _drawRackPower(
            coloTilesData: ColoData,
            coloStartX: string,
            coloStartY: number,
            xDelta: number,
            yDelta: number,
            headerHeight: number,
            footerHeight: number,
            xMargin: number,
            yMargin: number
        ) {
            var vm = this;

            this.dataLoadingProgress.start(DataLoadingState.Power);
            vm.$q.all([
                vm.powerCoolingRenderFactory.getDeployedRackPowerAsync(
                    parseInt(vm.dataModelService.currentDataCenterId),
                    parseInt(vm.dataModelService.currentColoId),
                    coloTilesData.deployedTiles,
                    coloStartX, coloStartY,
                    xDelta, yDelta,
                    headerHeight, footerHeight,
                    xMargin, yMargin
                ).then((results) => {
                    vm.deployedTileRectangles = results;
                }),

                vm.powerCoolingRenderFactory.getReservedTileRectanglesAsync(
                    parseInt(vm.dataModelService.currentDataCenterId),
                    parseInt(vm.dataModelService.currentColoId),
                    coloTilesData.reservedTiles,
                    coloStartX, coloStartY,
                    xDelta, yDelta,
                    headerHeight, footerHeight,
                    xMargin, yMargin
                ).then((results) => {
                    vm.reservedTileRectangles = results;
                })
            ]).then((values) => {
                this.dataLoadingProgress.end(DataLoadingState.Power);
            }).catch((err: any) => {
                this.dataLoadingProgress.end(DataLoadingState.Power);
            });
        }

    }

    // Filters
    export var tileSelectionCount = () => {
        return (selectedTilecount: number): string => {
            var retString;

            if (selectedTilecount === 0) {
                retString = "No tile selected";
            } else if (selectedTilecount === 1) {
                retString = "1 tile selected";
            } else {
                retString = "{0} tiles selected".format(selectedTilecount.toString());
            }

            return retString;
        };
    };

}