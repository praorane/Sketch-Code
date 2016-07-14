//  Copyright (c) Microsoft Corporation. All rights reserved
//  shared-blade-pending-actions.controller.ts
//  Controller for the shared blade control. 

/// <reference path="../../scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../defs/service-objects.ts" />
/// <reference path="../datamodel/data-model.service.ts" />
/// <reference path="../services/notification.service.ts" />
/// <reference path="../datamodel/data-load-state.service.ts" />
/// <reference path="../utilities/utilities.ts" />

namespace SketchSvg {
    'use strict';

    export class SharedBladePendingActionsController {
        public demandTypes: IDemandType[];
        public lstOfGroupRequests: IGroupRequest[];
        public demandFilter: string;
        public showDemandDetail: boolean;
        public selectedDemandType: IDemandType;
        public selectedGroupRequest: IGroupRequest;
        public lstOfReservationsGroupByOrderId: GroupReservationDisplay[] = [];
        public viewSpacePowerDetail: boolean = true;

        public get shouldShowAssignmentOfTiles(): boolean {
            // Only display Assign Tiles button when there are more than one order in a group request.
            return this.lstOfReservationsGroupByOrderId.length > 1;
        }

        private static _skuPowerAt100pctLoadW = '{0} ({1} W)';
        private static _orderDescription = '{0} {1} \n';
        private static _orderDetails = 'Order: {0}';
        private _handlerReleaser: HandlerReleaser;

        public static $inject = ['$scope', '$rootScope', '$q',
            '$state',
            'dataLoader', 'dataModelService', 'notificationService',
            'dataLoadingProgress'
        ];

        constructor(
            private $scope: angular.IScope,
            private $rootScope: angular.IRootScopeService,
            private $q: angular.IQService,
            private $state: angular.ui.IStateService,
            private _dataLoader: DataLoader,
            private _dataModelService: DataModelService,
            private _notificationService: NotificationService,
            private _dataLoadingProgress: DataLoadingProgress
        ) {
            var vm = this;

            vm.demandFilter = '';
            vm.showDemandDetail = false;
            vm.selectedGroupRequest = null;

            vm.demandTypes = [
                { id: undefined, name: 'All Demands' },
                { id: 'Wait', name: 'Required DC Action' },
                { id: 'SpcApproved', name: 'Required Network Action' },
                { id: 'Preliminary', name: 'Preliminary Reservation' },
                { id: 'Final', name: 'All Final Demands' }
            ];
            vm.selectedDemandType = vm.demandTypes[0];

            this._handlerReleaser = new HandlerReleaser(this.$scope);

            this._handlerReleaser.register(
                $scope.$on(AppCommand.tileSelectionChanged, (event, eventArg) => {
                    if (!this.shouldShowAssignmentOfTiles && this.lstOfReservationsGroupByOrderId.length === 1) {
                        // If there is no Assign Tiles button visible (only one order in this request),
                        // then we automatically start filling that order table.
                        this.assignRacksToSelectedTiles(this.lstOfReservationsGroupByOrderId[0]);
                    }
                })
            );

            this._handlerReleaser.register(
                vm.$rootScope.$on(AppCommand.selectDataCenter, (event, selectedDataCenter: IDataCenter) => {

                    vm._resetPendingView();
                    vm.exitDetailView();

                    if (angular.isDefined(selectedDataCenter)) {
                        this._dataLoadingProgress.start(DataLoadingState.GroupRequest);
                        vm._dataModelService.getGroupRequestsAtDataCenterAsync(parseInt(this._dataModelService.currentDataCenterId))
                            .then((data: GroupRequestsAtDataCenter): void => {
                                vm._aggregateGroupRequests(data.groupRequests);
                                this._dataLoadingProgress.end(DataLoadingState.GroupRequest);
                            })
                            .catch((error: TypeError) => {
                                this._dataLoadingProgress.end(DataLoadingState.GroupRequest);
                                vm._notificationService.notify(new NotificationMessage(
                                    'GetGroupRequestForDataCenterAsync Error',
                                    AppStringResources.generalError.format(error.message),
                                    ENotificationType.Error));
                            });
                    }
                })
            );
        }

        public filterPendingActions = (demand: IGroupRequest): boolean => {
            return (demand.FulfillmentStatus === this.selectedDemandType.id ||
                demand.ReservationAction === this.selectedDemandType.id ||
                angular.isUndefined(this.selectedDemandType.id));
        }

        public enterDetailView = (selectedGroupRequest: IGroupRequest): void => {
            this.showDemandDetail = true;
            this.$rootScope.$broadcast(AppCommand.enterReservationDetailView);
            this.selectedGroupRequest = selectedGroupRequest;
            this._dataLoadingProgress.start(DataLoadingState.DemandDetail);
            this._dataModelService.getGroupReservationsAtDataCenterAsync(this._dataModelService.currentDataCenterId)
                .then((groupReservation: GroupReservationDataAtDataCenter)
                    : angular.IPromise<void> => {
                    return this._aggregateGroupReservationsAsync(groupReservation);
                })
                .then((): void => {
                    this._dataLoadingProgress.end(DataLoadingState.DemandDetail);
                    this.$rootScope.$broadcast(AppCommand.setActiveDemand, this.selectedGroupRequest.Id);
                })
                .catch((error: TypeError) => {
                    this._dataLoadingProgress.end(DataLoadingState.DemandDetail);
                    this._notificationService.notify(new NotificationMessage(
                        'GetReservationsAtDataCenterAsync Error',
                        AppStringResources.generalError.format(error.message),
                        ENotificationType.Error));
                });
        }

        public exitDetailView() {
            var vm = this;
            vm.showDemandDetail = false;
            this.lstOfReservationsGroupByOrderId = [];
            this.$rootScope.$broadcast(AppCommand.exitReservationDetailView);
            this.$rootScope.$broadcast(AppCommand.resetActiveDemand);
        }

        public approveRequest() {

        }

        public rejectRequest() {

        }

        public reportIssue() {
            this.$state.go('plannerFeedbackRequest', {
                dcId: this._dataModelService.currentDataCenterId,
                coloId: this._dataModelService.currentColoId,
                groupId: this.selectedGroupRequest.Id
            });
        }

        public disableApproveRequest(): boolean {
            var disableApprove: boolean = true;
            if (this.selectedGroupRequest) {
                switch (this.selectedGroupRequest.ReservationAction) {
                    case ReservationAction[ReservationAction.Preliminary]:
                        disableApprove = true;
                        break;
                    case ReservationAction[ReservationAction.Final]:
                        // Assume Approve button is enabled.
                        disableApprove = false;
                        if (this.selectedGroupRequest.FulfillmentStatus[RequestFulfillmentStatus.Wait]) {
                            for (var i = 0; i < this.lstOfReservationsGroupByOrderId.length; i++) {
                                var groupReservation = this.lstOfReservationsGroupByOrderId[i];
                                if (!groupReservation.areAllTilesAssignedValue()) {
                                    // Disable Approve since we found out unassigned racks in the request group.
                                    disableApprove = true;
                                    break;
                                }
                            }
                        }
                        else if (this.selectedGroupRequest.FulfillmentStatus[RequestFulfillmentStatus.SpcApproved]) {
                            disableApprove = false;
                        }
                        break;
                }
            }
            return disableApprove;
        }

        public makeTileSelection(selectedRack: RackSelection, reservationGroup: GroupReservationDisplay) {
            var selectedTiles = selectedRack.racks;
            if (selectedTiles.length <= reservationGroup.getCountOfNotAssignedTiles()) {
                this._dataModelService.getDataCenterCatalogAsync().then((dataCenterCatalog: DataCenterCatalog) => {

                    var currentColocation = dataCenterCatalog.getColoInfoFromColoId(this._dataModelService.currentColoId);

                    selectedTiles.forEach((tile: ITileRect, index: number) => {
                        var emptyOrderReservation = reservationGroup.orderReservations.find((order) => angular.isUndefined(order.tileName) && angular.isUndefined(order.room), 0);

                        if (angular.isDefined(emptyOrderReservation)) {
                            emptyOrderReservation.tileName = tile.originalTile.Name;
                            emptyOrderReservation.room = currentColocation.Name;
                            emptyOrderReservation.tileId = tile.originalTile.Id;
                            emptyOrderReservation.isAssignedValue = true;
                            this.$rootScope.$broadcast(AppCommand.addTileAssignment, {
                                tileId: tile.originalTile.Id,
                                orderId: reservationGroup.orderId
                            })
                        }
                    });

                    this.$scope.$applyAsync((scope: angular.IScope) => {
                        selectedRack.clear();
                    });
                });
            }
        }

        public assignRacksToSelectedTiles(reservation: GroupReservationDisplay) {
            this.makeTileSelection(this._dataModelService.selection, reservation);
        }

        public clearReservation(reservation: GroupReservationDisplay) {
            reservation.clearTileAssignments(this.$rootScope);
        }

        public resetRackDetail(rackReservation: OrderReservationDisplay, reservation: GroupReservationDisplay) {
            rackReservation.resetDetails(this.$rootScope, reservation);
        }

        private _resetPendingView() {
            this.lstOfGroupRequests = undefined;
            this.demandFilter = '';
            this.selectedGroupRequest = null;
        }

        // Iterate over each group request and sum and store the number of requests of each type {PreRack, Discrete}
        private _aggregateGroupRequests(data: IGroupRequestResult) {
            this.lstOfGroupRequests = data.GroupRequests;
            this.lstOfGroupRequests.forEach((groupRequest: IGroupRequest) => {
                var preRackOrderCount = 0,
                    discreteOrderCount = 0;
                groupRequest.orderDescription = '';
                groupRequest.isVisible = groupRequest.FulfillmentStatus !== RequestFulfillmentStatus[RequestFulfillmentStatus.Failure] &&
                    groupRequest.FulfillmentStatus !== RequestFulfillmentStatus[RequestFulfillmentStatus.Success] &&
                    groupRequest.ReservationAction !== ReservationAction[ReservationAction.Canceled];
                if (groupRequest.isVisible) {
                    groupRequest.Orders.forEach((order: IOrder) => {
                        if (order.SkuType !== SkyuType[SkyuType.Discrete]) {
                            groupRequest.orderDescription += SharedBladePendingActionsController._orderDescription.format(order.SkuCount.toString(), order.SkuType);
                        }
                    });
                    groupRequest.orderDescription = groupRequest.orderDescription.replace(/\n$/, " ");
                    if (groupRequest.orderDescription === '') {
                        groupRequest.orderDescription = 'No orders';
                    }
                }
            });
        }

        private _aggregateGroupReservationsAsync(groupReservation: GroupReservationDataAtDataCenter)
            : angular.IPromise<void> {
            var retPromise: angular.IPromise<void>;

            var groupReservationByGroupId: IGroupReservation = groupReservation.getGroupReservationByGroupId(this.selectedGroupRequest.Id);
            if (groupReservationByGroupId) {
                retPromise = this._dataModelService.findAndCacheSkuDetailsByMsfPartNumbersAsync(groupReservation.listOfMsfPartNumbers)
                    .then((): angular.IPromise<void> => {
                        return this._aggregategroupRequestWithGroupReservationAsync(groupReservationByGroupId);
                    });
            }
            else {
                retPromise = this._aggregategroupRequestWithOutGroupReservationAsync();
            }

            return retPromise;
        }

        private _aggregategroupRequestWithGroupReservationAsync(groupReservationByGroupId: IGroupReservation)
            : angular.IPromise<void> {
            return this._dataModelService.getDataCenterCatalogAsync()
                .then((dataCenterCatalog: DataCenterCatalog): angular.IPromise<void> => {
                    var colocation = dataCenterCatalog.getColoInfoFromColoId(groupReservationByGroupId.coloId.toString());
                    if (colocation) {
                        return this._dataModelService.getTilesAsync(colocation.Id)
                            .then((coloData): void => {
                                groupReservationByGroupId.orders.forEach((orderReservation: IOrderReservation) => {
                                    var order = this.selectedGroupRequest.Orders.find((order) => {
                                        return parseInt(order.Id) === orderReservation.orderId;
                                    });
                                    if (order && order.SkuType !== SkyuType[SkyuType.Discrete]) {
                                        var lstOfOrderReservation: OrderReservationDisplay[] = [];
                                        orderReservation.rackReservations.forEach((rackReservation: IRackReservation) => {

                                            var orderReservationDisplay = new OrderReservationDisplay();

                                            orderReservationDisplay.room = colocation.Name;

                                            orderReservationDisplay.energyDetails = SharedBladePendingActionsController._skuPowerAt100pctLoadW.format(rackReservation.msfPartNumber,
                                                (this._dataModelService.getSkuDetailByMsfPartNumberFromCache(rackReservation.msfPartNumber)).SkuPowerAt100pctLoadW.toString());
                                            orderReservationDisplay.tileName = (<ITileInfo>coloData.tileMapKeyedByTileId[rackReservation.tileId]).Name;
                                            orderReservationDisplay.isAssignedValue = true;
                                            orderReservationDisplay.tileId = rackReservation.tileId;

                                            lstOfOrderReservation.push(orderReservationDisplay);
                                        });
                                        var reservationGroup = new GroupReservationDisplay(this._notificationService, this._dataModelService);
                                        reservationGroup.orderId = orderReservation.orderId;
                                        reservationGroup.lockType = groupReservationByGroupId.lockType;
                                        reservationGroup.fulfillmentStatus = this.selectedGroupRequest.FulfillmentStatus;
                                        reservationGroup.orderReservations = lstOfOrderReservation;

                                        this.lstOfReservationsGroupByOrderId.push(reservationGroup);
                                    }
                                });
                            });
                    }
                    return;
                })
        }

        private _aggregategroupRequestWithOutGroupReservationAsync()
            : angular.IPromise<void> {
            var promises: Array<angular.IPromise<IOrderSkuResult>> = [];
            this.selectedGroupRequest.Orders.forEach((order: IOrder) => {
                if (order.SkuType !== SkyuType[SkyuType.Discrete]) {
                    promises.push(this._dataModelService.findAndCacheSkuDetailsByMsfPartNumbersAsync(new Array<string>(order.MsfPartNumber))
                        .then((succeeded: boolean) => {
                            return {
                                order: order,
                                succeeded: succeeded
                            };
                        })
                        .catch((err) => {
                            return {
                                order: order,
                                succeeded: false
                            }
                        })
                    );
                }
            });
            return this.$q.all(promises).then((results: Array<IOrderSkuResult>): void => {
                results.forEach((result: IOrderSkuResult) => {
                    if (result.succeeded) {
                        var order = result.order;
                        var lstOfOrderReservation: OrderReservationDisplay[] = [];

                        for (var i = 0; i < order.SkuCount; i++) {
                            var orderReservationDisplay = new OrderReservationDisplay();
                            orderReservationDisplay.energyDetails = SharedBladePendingActionsController._skuPowerAt100pctLoadW.format(order.MsfPartNumber,
                                (this._dataModelService.getSkuDetailByMsfPartNumberFromCache(order.MsfPartNumber)).SkuPowerAt100pctLoadW.toString());

                            lstOfOrderReservation.push(orderReservationDisplay);
                        }
                        var reservationGroup = new GroupReservationDisplay(this._notificationService, this._dataModelService);
                        reservationGroup.orderId = parseInt(order.Id);
                        reservationGroup.orderReservations = lstOfOrderReservation;
                        reservationGroup.fulfillmentStatus = this.selectedGroupRequest.FulfillmentStatus;
                        this.lstOfReservationsGroupByOrderId.push(reservationGroup);
                    }
                });
            });
        }
    }

    export var requestFulfillmentStatusDisplay = () => {
        return (status: string): string => {
            var retString;
            if (status === RequestFulfillmentStatus[RequestFulfillmentStatus.Wait]) {
                retString = 'Pending DC review';
            } else if (status === RequestFulfillmentStatus[RequestFulfillmentStatus.SpcApproved]) {
                retString = 'Pending network review';
            }
            else {
                retString = RequestFulfillmentStatus[status];
            }
            return retString;
        };
    };

    class OrderReservationDisplay {
        public room: string;
        public tileName: string;
        public tileId: number;
        public energyDetails: string;
        public isAssignedValue: boolean;

        constructor() {
            var vm = this;
            vm.room = undefined;
            vm.tileName = undefined;
            vm.energyDetails = undefined;
            vm.isAssignedValue = false;
        }

        public resetDetails(rootScope: angular.IRootScopeService, groupReservation?: GroupReservationDisplay) {
            if (angular.isUndefined(this.tileId)) {
                return;
            }

            var tileId: number = this.tileId;
            this.room = undefined;
            this.tileName = undefined;
            this.tileId = undefined;
            this.isAssignedValue = false;
            rootScope.$broadcast(AppCommand.removeTileAssignment, tileId);
        }
    }

    class GroupReservationDisplay {
        public orderId: number;
        public isExpanded: boolean = true;
        public lockType: string;
        public fulfillmentStatus: string;
        public orderReservations: OrderReservationDisplay[] = [];
        private static successfulAssignment: string = `You have successfully completed assignment for demand {0}.
                                                      Your action has not impacted any other demands. You can now 
                                                      assign tiles for other demands.
                                                     `;

        constructor(
            private _notificationService: NotificationService,
            private _dataModelService: DataModelService
        ) {
        }

        public getCountOfNotAssignedTiles(): number {
            return this.orderReservations.filter((order) => !order.isAssignedValue).length;
        }

        public areAllTilesAssignedValue(): boolean {
            return this.getCountOfNotAssignedTiles() === 0;
        }

        public disableAssignmentOfTiles(): boolean {
            var disableAssign = true;
            var numberOfNotAssignedTiles = this.getCountOfNotAssignedTiles();
            var numberOfSelectedTiles = this._dataModelService.selection.racks.length;

            if (this.fulfillmentStatus === RequestFulfillmentStatus[RequestFulfillmentStatus.SpcApproved]){
                disableAssign = true;
                return;
            }

            if (angular.isDefined(this.lockType) && this.lockType === ReservationLockType[ReservationLockType.Hard]) {
                disableAssign = true;
                return;
            } else {
                // Finally, a user can assign rack to specified tile location.
                if (numberOfSelectedTiles === 0) {
                    // No tile rack can be assigned to.
                    disableAssign = true;
                } else {
                    // Disable assign button if too many tile locations are selected.
                    // This is we cannot figure out how to move the unassigned racks to 
                    // the tiles which are more than the number of those racks.
                    disableAssign = numberOfSelectedTiles > numberOfNotAssignedTiles;
                }
            }
            return disableAssign;
        }

        public disableClearOfTiles(): boolean {
            var disableClear: boolean = false;
            if (this.fulfillmentStatus === RequestFulfillmentStatus[RequestFulfillmentStatus.SpcApproved]) {
                disableClear = true;
            }
            return disableClear;
        }

        public clearTileAssignments(rootScope: angular.IRootScopeService) {
            this.orderReservations.forEach((orderReservation: OrderReservationDisplay) => {
                orderReservation.resetDetails(rootScope);
            });
        }
    }

    interface IDemandType {
        id: string;
        name: string;
    }

    interface IOrderSkuResult {
        order: IOrder;
        succeeded: boolean;
    }
}