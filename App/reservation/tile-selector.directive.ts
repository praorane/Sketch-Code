// Copyright (c) Microsoft Corporation. All rights reserved
//  tile-allocator.directive.ts
//  The implementation of tile allocation logic

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../services/reservation-detail.service.ts" />
/// <reference path="../services/rack-detail.service.ts" />
/// <reference path="../datamodel/data-model.service.ts" />
/// <reference path="../mapview/layout-view.directive.ts" />
/// <reference path="../services/basic-layout.service.ts" />
/// <reference path="../utilities/utilities.ts" />

module SketchSvg {
    'use strict';

    export interface IReversationTileInfo {
        tileId: number;
        orderId: number;
    }

    export class TileSelector implements angular.IDirective {
        public restrict: string = 'E';
        public require: Array<string> = ['^^layoutView', '^^colocationMap'];
        public replace: boolean = true;

        public controller = 'TileSelectorController';
        public controllerAs = 'tileSelectorController';
        public bindToController = true;

        constructor(private $compile, private $templateRequest) {
        }

        public templateNamespace: string = 'svg';
        public templateUrl = 'App/reservation/tile-selector.template.html';

        public link: angular.IDirectiveLinkFn = (
            scope: ITileSelectorControllerScope,
            element: angular.IAugmentedJQuery,
            attrs,
            controllers: Array<Object>) => {
            scope.tileSelectorController.initialize(
                <LayoutViewController>controllers[0],
                <MapController>controllers[1]
            );
        }
    }

    export class TileSelectorController {
        public get renderedTiles(): Array<TileRenderingInfo> {
            return this._renderedTiles;
        }

        public get selectedTiles(): Array<ITileRect> {
            var tiles = [];
            if (this._selectableTiles) {
                for (var selectableTileId in this._selectableTiles) {
                    var selectableTile = this._selectableTiles[selectableTileId];
                    if (selectableTile.isSelected) {
                        tiles.push(selectableTile.tileRect);
                    }
                }
            }
            return tiles;
        }

        public get selectionRect(): IRect {
            return this._selectionRect;
        }

        public static $inject = [
            '$scope',
            '$q',
            '$log',
            'dataModelService'
        ];

        private _layoutViewCtrl: LayoutViewController;
        private _mapController: MapController;
        private _handlerReleaser: HandlerReleaser;
        private _originalAssignedTileIds: Array<number> = [];
        private _renderedTiles: Array<TileRenderingInfo> = [];
        private _ignoreSelection: boolean;
        private _rackTileRects: Array<ITileRect> = [];
        private _selectionRect: IRect;
        private _selectableTiles: {
            [tileId: string]: ITileSelection
        };

        constructor(
            private $scope: angular.IScope,
            private $q: angular.IQService,
            private $log: angular.ILogService,
            private dataModelService: DataModelService
        ) {
            var vm = this;
            this._handlerReleaser = new HandlerReleaser(this.$scope);
            this._handlerReleaser.register(
                $scope.$on(AppCommand.setActiveDemand, (event, eventArg) => {
                    this._resetRenderingData();
                    this._setActiveDemandGroup(<string>(eventArg));
                })
            );

            this._handlerReleaser.register(
                $scope.$on(AppCommand.resetActiveDemand, (event, eventArg) => {
                    this._resetRenderingData();
                })
            );

            this._handlerReleaser.register(
                $scope.$on(AppCommand.removeTileAssignment, (event, eventArg) => {
                    this._resetTileAssignment(<number>(eventArg));
                })
            );

            this._handlerReleaser.register(
                $scope.$on(AppCommand.addTileAssignment, (event, eventArg) => {
                    this._setTileAssignment(<IReversationTileInfo>(eventArg));
                })
            );

            this._handlerReleaser.register(
                $scope.$watchCollection((scope: angular.IScope) => {
                    return this.dataModelService.selection.racks;
                }, (newRacks: Array<ITileRect>, oldRacks: Array<ITileRect>) => {
                    if (newRacks.length === 0) {
                        // Reset the selection visual
                        this._scanSelectableRackTiles();
                    }
                })
            );

        }

        public initialize(layoutCtrl: LayoutViewController, mapCtrl: MapController) {
            this._layoutViewCtrl = layoutCtrl;
            this._mapController = mapCtrl;
            this._handlerReleaser.register(
                this.$scope.$watch(() => {
                        return this._mapController.selectionInfo;
                    },
                    (newValue: ISelectionInfo, oldValue: ISelectionInfo) => {
                        if (newValue !== oldValue) {
                            if (angular.isDefined(newValue)) {
                                this._updateTileSelection(newValue);
                            }
                        }
                    }
                )
            );
        }

        private _setActiveDemandGroup(activeGroupId: string) {
            // This is how we render the tile assignment when a user is working on updating rack location.
            //  1. Whenever tiles are assigned to the current group request, we will render those as assigned rack tiles
            //     with order numbers on them.
            //  2. If tiles are removed from the group request, depending on the whether those tiles are originally assigned 
            //     to the group or not, we will render the tiles differently.
            //      a. If they were part of the original assignment, we will always render them as available tiles.
            //      b. If they weren't part of the original assignment, we will simply not render those tiles. So 
            //         visually, those tiles will be displayed as current states - either available or  preliminary-reserved.

            this.dataModelService.getGroupReservationsAtDataCenterAsync(this.dataModelService.currentDataCenterId)
                .then((groupReservation: GroupReservationDataAtDataCenter) => {
                    var reservationGroup: IGroupReservation = groupReservation.getGroupReservationByGroupId(activeGroupId);
                    var tiles: Array<IReversationTileInfo> = [];
                    if (reservationGroup) {
                        reservationGroup.orders.forEach((order: IOrderReservation) => {
                            order.rackReservations.forEach((rackReservation: IRackReservation) => {
                                tiles.push({
                                    tileId: rackReservation.tileId,
                                    orderId: order.orderId
                                });
                            });
                        });
                    }
                    this._prepareRenderingData(tiles);
                });
        }

        private _resetRenderingData() {
            this._originalAssignedTileIds.splice(0, this._originalAssignedTileIds.length);
            this._renderedTiles.splice(0, this._renderedTiles.length);
        }

        private _prepareRenderingData(originalTiles: Array<IReversationTileInfo>) {
            var layoutCtrl = this._layoutViewCtrl;
            var coloData = layoutCtrl.coloData;
            var tiles: Array<ITileInfo> = [];

            if (originalTiles.length !== 0) {
                var i;
                var tileId2OrderIdMap = {};
                for (i = 0; i < originalTiles.length; i++) {
                    this._originalAssignedTileIds.push(originalTiles[i].tileId);
                    var tileInfo = coloData.tileMapKeyedByTileId[originalTiles[i].tileId];
                    // tileInfo may be null when racks are assigned to the other colos.
                    if (tileInfo) {
                        tiles.push(tileInfo);
                        tileId2OrderIdMap[originalTiles[i].tileId.toString()] = originalTiles[i].orderId;
                    }
                }
                var rackTiles: Array<ITileRect> = SpaceRendererFactory.getBoundingRectsForRackTiles(
                    tiles,
                    layoutCtrl.coloStartX, layoutCtrl.coloStartY,
                    layoutCtrl.xDelta, layoutCtrl.yDelta,
                    layoutCtrl.headerHeight, layoutCtrl.footerHeight,
                    layoutCtrl.xMargin, layoutCtrl.yMargin);

                for (i = 0; i < rackTiles.length; i++) {
                    var info = new TileRenderingInfo(rackTiles[i]);
                    info.orderId = tileId2OrderIdMap[rackTiles[i].originalTile.Id];
                    this._renderedTiles.push(info);
                }
            }

            tiles = coloData.data.Tiles.filter((tile) => {
                return tile.Class === 'Server' || tile.Class === 'Network'
            });

            this._rackTileRects = SpaceRendererFactory.getBoundingRectsForRackTiles(
                tiles,
                layoutCtrl.coloStartX, layoutCtrl.coloStartY,
                layoutCtrl.xDelta, layoutCtrl.yDelta,
                layoutCtrl.headerHeight, layoutCtrl.footerHeight,
                layoutCtrl.xMargin, layoutCtrl.yMargin);

            this._scanSelectableRackTiles();
        }

        private _setTileAssignment(reservationTileInfo: IReversationTileInfo) {
            var tileId = reservationTileInfo.tileId;
            var indexInRenderingData = -1;
            for (var i = 0; i < this._renderedTiles.length; i++) {
                if (this._renderedTiles[i].originalTile.Id === tileId) {
                    indexInRenderingData = i;
                    break;
                }
            }

            if (indexInRenderingData === -1) {
                var layoutCtrl = this._layoutViewCtrl;

                var newTile: Array<ITileInfo> = [];
                newTile.push(layoutCtrl.coloData.tileMapKeyedByTileId[tileId]);
                var rackTiles: Array<ITileRect> = SpaceRendererFactory.getBoundingRectsForRackTiles(
                    newTile,
                    layoutCtrl.coloStartX, layoutCtrl.coloStartY,
                    layoutCtrl.xDelta, layoutCtrl.yDelta,
                    layoutCtrl.headerHeight, layoutCtrl.footerHeight,
                    layoutCtrl.xMargin, layoutCtrl.yMargin);

                var info = new TileRenderingInfo(rackTiles[0]);
                info.orderId = reservationTileInfo.orderId;
                this._renderedTiles.push(info);
            } else {
                this._renderedTiles[indexInRenderingData].isFreed = false;
                this._renderedTiles[indexInRenderingData].orderId = reservationTileInfo.orderId;
                if (this._originalAssignedTileIds.indexOf(tileId) === -1) {
                    this.$log.warn('Cannot find indexInOriginalAssignment in _originalAssignedTileIds');
                }
            }
        }

        private _resetTileAssignment(tileId) {
            var indexInOriginalAssignment = this._originalAssignedTileIds.indexOf(tileId);
            var indexInRenderingData = -1;
            for (var i = 0; i < this._renderedTiles.length; i++) {
                if (this._renderedTiles[i].originalTile.Id === tileId) {
                    indexInRenderingData = i;
                    break;
                }
            }

            if (indexInRenderingData !== -1) {
                if (indexInOriginalAssignment !== -1) {
                    this._renderedTiles[indexInRenderingData].isFreed = true;
                } else {
                    this._renderedTiles.splice(indexInRenderingData, 1);
                }
            }
        }

        private _scanSelectableRackTiles() {
            var getSelectableTiles = (groupReservationData: GroupReservationDataAtDataCenter) => {
                this._selectableTiles = {};

                for (var i = 0; i < this._rackTileRects.length; i++) {
                    var rackTile = this._rackTileRects[i];
                    var originalTile = rackTile.originalTile;
                    var isSelectable = false;   // unselectable by default

                    // First, let's check whether rackTile is in our tile rendering list.
                    // Keep in mind that we don't remove the original tile assignment from the rendering list.
                    // Instead, we just mark isFreed flag if a user clear the tile assignment.
                    var renderedTile = this._renderedTiles.find((tile: TileRenderingInfo) => {
                        return tile.originalTile.Id === rackTile.originalTile.Id;
                    });

                    if (renderedTile) {
                        isSelectable = renderedTile.isFreed;
                        if (!isSelectable) {
                            // If rackTile is in the rendering list and not freed, 
                            // this rack won't be able to be selected. Move onto the next rackTile.
                            // Otherwise, mark isSelectable is true since the tile is freed.
                            continue;
                        }
                    }

                    if (!isSelectable) {
                        // At last, check whether we the rack tile is sitting on available tiles or prelimiary tiles
                        switch (originalTile.Status) {
                            case RackTileStatus.available:
                                isSelectable = true;
                                break;
                            case RackTileStatus.reserved:
                                // If we don't have reservation data, then we don't know how to treat those
                                // reserved tiles. So mark them as unselectable.
                                if (groupReservationData) {
                                    var rackReservation = groupReservationData.getRackReservationByTileId(originalTile.Id);
                                    isSelectable = rackReservation.type === ReservationType[ReservationType.Preliminary];
                                }
                                break;
                            case RackTileStatus.used:
                                break;
                        }
                    }

                    if (isSelectable) {
                        this._selectableTiles[originalTile.Id] = {
                            isSelected: false,
                            tileRect: rackTile
                        }
                    }
                }
            };

            this.dataModelService.getGroupReservationsAtDataCenterAsync(
                this.dataModelService.currentDataCenterId)
                .then((groupReservationData: GroupReservationDataAtDataCenter) => {
                    getSelectableTiles(groupReservationData);
                },
                (failure) => {
                    // Cannot retrieve the reservation data.
                    getSelectableTiles(null);
                });

        };

        private _updateTileSelection(selectionInfo: ISelectionInfo) {
            if (!this._ignoreSelection) {
                var layoutCtrl = this._layoutViewCtrl;
                var clientRect = layoutCtrl.boundingClientRect;
                this._selectionRect = {
                    x: selectionInfo.rect.x - clientRect.left,
                    y: selectionInfo.rect.y - clientRect.top,
                    width: selectionInfo.rect.width,
                    height: selectionInfo.rect.height
                };
                var zoomLevel = layoutCtrl.zoomLevel;
                var hitRect = {
                    x: this._selectionRect.x / zoomLevel,
                    y: this._selectionRect.y / zoomLevel,
                    width: this._selectionRect.width / zoomLevel,
                    height: this._selectionRect.height / zoomLevel,
                };

                if (selectionInfo.state === SelectionBehaviorState.started) {
                    if (this._hitSelectedTiles({
                        x: hitRect.x,
                        y: hitRect.y
                    })) {
                        // If a user hits a currently selected tile when a selection starts,
                        // we should just ignore the entire selection process. So we don't
                        // accidently clear the user selection.
                        this._ignoreSelection = true;
                        return;
                    } else {
                        // Otherwise, reset the current one while a new selection just starts
                        this._scanSelectableRackTiles();
                    }
                }

                this._hitTest(hitRect);
            }

            if (selectionInfo.state === SelectionBehaviorState.ended) {
                this._selectionRect = undefined;
                this._ignoreSelection = false;
                this._mapController.onSelectionCommitted(this.selectedTiles);
            }
        }

        private _hitSelectedTiles(position: IPoint)
            : boolean {
            var hit = false;
            var selectedTiles = this.selectedTiles;
            for (var i = 0; i < selectedTiles.length; i++) {
                var rackTileRect = this._normalizeRect(selectedTiles[i]);
                if (rackTileRect.x <= position.x
                    && rackTileRect.x + rackTileRect.width > position.x
                    && rackTileRect.y <= position.y
                    && rackTileRect.y + rackTileRect.width > position.y) {
                    hit = true;
                    break;
                }
            }

            return hit;
        }

        private _hitTest(rect: IRect) {
            var selectionRect = this._normalizeRect(rect);

            for (var selectableTileId in this._selectableTiles) {
                var selectableTile = this._selectableTiles[selectableTileId];
                var rackTileRect = this._normalizeRect(selectableTile.tileRect);

                if ((rackTileRect.x > selectionRect.x + selectionRect.width)
                    || (rackTileRect.x + rackTileRect.width < selectionRect.x)
                    || (rackTileRect.y > selectionRect.y + selectionRect.height)
                    || (rackTileRect.y + rackTileRect.height < selectionRect.y)) {
                    // Two rectangles are not overlapping. Deselect the tile.
                    selectableTile.isSelected = false;
                } else {
                    // Two rectangles are overlapping. Select the tile.
                    selectableTile.isSelected = true;
                }
            }
        }

        private _normalizeRect(inputRect: IRect)
            : IRect {
            /// This function normalize a rectangle. So its x and y values are
            // always toward to top-left corner.

            var rectX1, rectX2, rectY1, rectY2;
            if (inputRect.x <= inputRect.x + inputRect.width) {
                rectX1 = inputRect.x;
                rectX2 = inputRect.x + inputRect.width;
            } else {
                rectX2 = inputRect.x;
                rectX1 = inputRect.x + inputRect.width;
            }
            if (inputRect.y <= inputRect.y + inputRect.height) {
                rectY1 = inputRect.y;
                rectY2 = inputRect.y + inputRect.height;
            } else {
                rectY2 = inputRect.y;
                rectY1 = inputRect.y + inputRect.height;
            }
            return {
                x: rectX1,
                y: rectY1,
                width: rectX2 - rectX1,
                height: rectY2 - rectY1
            };
        }

    }

    interface ITileSelectorControllerScope extends angular.IScope {
        tileSelectorController: TileSelectorController;
    }

    interface ITileSelection {
        isSelected: boolean;
        tileRect: ITileRect;
    }

    class TileRenderingInfo implements ITileRect {
        public isFreed: boolean;
        public orderId: number;

        public get x() {
            return this._tileRect.x;
        }

        public get y() {
            return this._tileRect.y;
        }

        public get width() {
            return this._tileRect.width;
        }

        public get height() {
            return this._tileRect.height;
        }

        public get tileAlignment() {
            return this._tileRect.tileAlignment;
        }

        public get originalTile() {
            return this._tileRect.originalTile;
        }

        constructor(private _tileRect: ITileRect) {
            this.isFreed = false;
        }
    }

}