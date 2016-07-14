// Copyright (c) Microsoft Corporation. All rights reserved
//  data-model.service.ts
//  The implementation of the sketch data model

/// <reference path="../../Scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../defs/service-objects.ts" />
/// <reference path="../datamodel/datafetcher-factories.ts" />

namespace SketchSvg {
    'use strict';

    export interface ITileGroupByRow {
        tilesInVerticalRows: Array<any>;
        tilesInHorizontalRows: Array<any>;
    }

    export interface ITilesGroupedByOrder extends IReservationOrderKey, ITileGroupByRow {
    } 


    export class ColoData {
        /// <summary>
        ///     A wrapper class for the raw ColoData retrieved from service call
        ///     <SketchServer>/api/Colocation/GetStatusTiles 
        /// </summary>

        private static c_tileMapClasses = ['Server', 'Network'];
        private _tilesKeyedById: {
            [tileId: string]: ITileInfo
        } = null;
        private _networkDevices: Array<ITileInfo> = null;
        private _serverTiles: Array<ITileInfo> = null;
        private _deployedTiles: Array<ITileInfo> = null;
        private _reservedTiles: Array<ITileInfo> = null;

        constructor(private _coloData: IRawColoData) {
        }

        public get tileMapKeyedByTileId() : {
            [tileId: string]: ITileInfo} {
            if (!this._tilesKeyedById) {
                this._tilesKeyedById = {};
                this._ensureTileIdMap();
            }

            return this._tilesKeyedById;
        }

        public get data(): IRawColoData {
            return this._coloData;
        }

        public get networkDeviceTiles(): Array<ITileInfo> {
            if (!this._networkDevices) {
                this._networkDevices = this._coloData.Tiles.filter((tile) => {
                    return tile.Class === 'Network';
                });
            }
            return this._networkDevices;
        }

        public get serverTiles(): Array<ITileInfo> {
            if (!this._serverTiles) {
                this._serverTiles = this._coloData.Tiles.filter((tile: ITileInfo) => {
                    return tile.Class === 'Server';
                });
            }
            return this._serverTiles;
        }

        public get deployedTiles(): Array<ITileInfo> {
            if (!this._deployedTiles) {
                this._deployedTiles = this._coloData.Tiles.filter((tile: ITileInfo) => {
                    return tile.Class === 'Server' && tile.Status === RackTileStatus.used ;
                });
            }
            return this._deployedTiles;
        }

        public get reservedTiles(): Array<ITileInfo> {
            if (!this._reservedTiles) {
                this._reservedTiles = this._coloData.Tiles.filter((tile: ITileInfo) => {
                    return tile.Class === 'Server' && tile.Status === RackTileStatus.reserved;
                });
            }
            return this._reservedTiles;
        }

        private _ensureTileIdMap() {
            this._coloData.Tiles.forEach((tile) => {
                if (ColoData.c_tileMapClasses.indexOf(tile.Class) !== -1) {
                    this._tilesKeyedById[tile.Id] = tile;
                }
            });
        }
    }

    export interface IRawColoData {
        StartY: string;
        StartX: string;
        ColoXSize: number;
        ColoYSize: number;
        Tiles: Array<ITileInfo>;
        ErrorCode: number;
        ErrorMessage: string;
    }

    export interface IRackReservationEx extends IRackReservation {
        type: string;
    }

    export class GroupRequestsAtDataCenter {
        public get groupRequests(): IGroupRequestResult {
            return this._groupRequest;
        }

        constructor(private _groupRequest: IGroupRequestResult) {
        }

        public getGroupRequestByGroupId(groupId: string)
            : IGroupRequest {
            var groupRequest: IGroupRequest;
            var requests = this._groupRequest.GroupRequests;
            for (var i = 0; i < requests.length; i++) {
                if (requests[i].Id === groupId) {
                    groupRequest = requests[i];
                    break;
                }
            }

            return groupRequest;
        }
    }

    export class GroupReservationDataAtDataCenter {
        private _msfPartNumberList: Array<string> = [];
        private _tileToRackReservationMap: { [tileId: number]: IRackReservationEx } = {};
        private _groupIdToGroupReservationMap: { [groupId: string]: IGroupReservation } = {};

        constructor(private _groupReservations: Array<IGroupReservation>) {
            this._groupReservations.forEach((groupReservation: IGroupReservation) => {
                this._groupIdToGroupReservationMap[groupReservation.groupId] = groupReservation;
                groupReservation.orders.forEach((orderReservation: IOrderReservation) => {
                    orderReservation.rackReservations.forEach((rackReservation: IRackReservation) => {
                        this._tileToRackReservationMap[rackReservation.tileId] = {
                            msfPartNumber: rackReservation.msfPartNumber,
                            tileId: rackReservation.tileId,
                            rackId: rackReservation.rackId,
                            powerNeeded: rackReservation.powerNeeded,
                            coolingReserved: rackReservation.coolingReserved,
                            type: groupReservation.type
                        };
                        if (this._msfPartNumberList.indexOf(rackReservation.msfPartNumber) === -1) {
                            this._msfPartNumberList.push(rackReservation.msfPartNumber);
                        }
                    });
                });
            });
        }

        public get listOfMsfPartNumbers(): Array<string> {
            return this._msfPartNumberList;
        }

        public getRackReservationByTileId(tileId: number): IRackReservationEx {
            return this._tileToRackReservationMap[tileId];
        }

        public getGroupReservationByGroupId(groupId: string): IGroupReservation {
            return this._groupIdToGroupReservationMap[groupId];
        }

        public getOrderGroups(coloData: ColoData)
            : Array<IReservationOrderRacks> {
            var orderSubgroups: Array<IReservationOrderRacks> = [];
            var reservations: Array<IGroupReservation> = this._groupReservations;
            var tilesByGroups: Array<ITilesGroupedByOrder> = [];
            reservations.forEach((reservation) => {
                reservation.orders.forEach((order) => {
                    var tileGroup = tilesByGroups.find(function (group) {
                        return group.demandId === reservation.demandId
                            && group.type === reservation.type
                            && group.orderId === order.orderId;
                    });

                    if (!tileGroup) {
                        tileGroup = {
                            demandId: reservation.demandId,
                            coloId: reservation.coloId,
                            groupId: reservation.groupId,
                            propertyGroupName: reservation.propertyGroupName,
                            orderId: order.orderId,
                            type: reservation.type,
                            tilesInVerticalRows: null,
                            tilesInHorizontalRows: null
                        };
                        tilesByGroups.push(tileGroup);
                    }

                    order.rackReservations.forEach((rackReservation) => {
                        var tile = coloData.tileMapKeyedByTileId[rackReservation.tileId];
                        if (!tile) {
                            // Cannot find the tile in the current colo. Skip this.
                            return;
                        }

                        if (RackDetailRendererFactory.isHorizontalTile(tile)) {
                            // When a tile's association direction is horizontal,
                            // we know the tile is in a vertical row.
                            if (!tileGroup.tilesInVerticalRows) {
                                tileGroup.tilesInVerticalRows = [];
                            }
                            tileGroup.tilesInVerticalRows.push(tile);
                        } else {
                            // When a tile's association direction is vertical,
                            // we know the tile is in a horizontal row.
                            if (!tileGroup.tilesInHorizontalRows) {
                                tileGroup.tilesInHorizontalRows = [];
                            }
                            tileGroup.tilesInHorizontalRows.push(tile);
                        }
                    });
                });
            });

            tilesByGroups.forEach((group) => {
                var subgroups = RackDetailRendererFactory.groupConnectedTiles(group);
                if (subgroups.length !== 0) {
                    orderSubgroups.push({
                        demandId: group.demandId,
                        groupId: group.groupId,
                        coloId: group.coloId,
                        propertyGroupName: group.propertyGroupName,
                        orderId: group.orderId,
                        type: group.type,
                        rackSubgroups: subgroups
                    });
                }
            });

            return orderSubgroups;
        }

    }

    export class RackDataAtDataCenter {
        private _tileNameToRackMap: { [colocationId: number]: { [name: string]: IRack } } = {};
        private _colocationToRacksMap: { [colocationId: number]: Array<IRack> } = {};

        public getRacksAtColocation(colocationId: number): Array<IRack> {
            return this._colocationToRacksMap[colocationId];
        }

        public getRackInformationByTileName(colocationId: number, tileName: string): IRack {
            return this._tileNameToRackMap[colocationId]
                ? this._tileNameToRackMap[colocationId][tileName]
                : undefined;
        }

        constructor(private _racks: Array<IRack>) {
            _racks.forEach((rack) => {
                if (this._colocationToRacksMap[rack.ColocationId] === undefined) {
                    this._colocationToRacksMap[rack.ColocationId] = [];
                }
                this._colocationToRacksMap[rack.ColocationId].push(rack);

                if (this._tileNameToRackMap[rack.ColocationId] === undefined) {
                    this._tileNameToRackMap[rack.ColocationId] = {};
                }
                this._tileNameToRackMap[rack.ColocationId][rack.Tile] = rack;
            });
        }
    }

    export class DataCenterCatalog {
        private _dataCentersAndColo: Array<IDataCenterAndColoInfo> = [];

        constructor(private datacenters: Array<IDataCenterAndColoInfo>) {
            this._dataCentersAndColo = datacenters;
        }

        public getDataCenterAndColo() {
            return this._dataCentersAndColo;
        }

        public getDcInfoFromDcId(dcId: string): IDataCenterAndColoInfo {
            var matchedDataCenter: IDataCenterAndColoInfo = null;
            for (var i = 0; i < this._dataCentersAndColo.length; i++) {
                if (this._dataCentersAndColo[i].Id === dcId) {
                    matchedDataCenter = this._dataCentersAndColo[i];
                    break;
                }
            }
            return matchedDataCenter;
        }

        public getDcInfoFromColoId(coloId: string): IDataCenterAndColoInfo {
            var matchedDataCenter: IDataCenterAndColoInfo = null;
            for (var i = 0; i < this._dataCentersAndColo.length; i++) {
                var targetColo = this._dataCentersAndColo[i].Colocations.find((colo) => colo.Id === coloId);
                if (targetColo) {
                    matchedDataCenter = this._dataCentersAndColo[i];
                    break
                }
            }
            return matchedDataCenter;
        }

        public getColoInfoFromColoId(coloId: string): IColocation {
            var matchedColo: IColocation;
            for (var i = 0; i < this._dataCentersAndColo.length; i++) {
                var targetColo = this._dataCentersAndColo[i].Colocations.find((colo) => colo.Id === coloId);
                if (targetColo) {
                    matchedColo = targetColo;
                    break;
                }
            }
            return matchedColo;
        }
    }

    export class RackSelection {
        private _selectedRacks: Array<ITileRect>;

        constructor() {
        }

        public get racks(): Array<ITileRect> {
            if (angular.isUndefined(this._selectedRacks)) {
                this._selectedRacks = [];
            }

            return this._selectedRacks;
        }

        public set racks(selection: Array<ITileRect>)  {
            this._selectedRacks = selection;
        }

        public clear() {
            this._selectedRacks.splice(0, this._selectedRacks.length);
        }
    }

    export class IncidentReasonsData {
        constructor(private _rawIncidentReasons: IIcmIncidentReasons) {
        }

        public getReasonsByType(incidentType: string) {
            return this._rawIncidentReasons.Reasons
                .filter((reason) => {
                    return reason.IncidentType === incidentType;
                }).sort((reason1, reason2): number => {
                    // Sort reasons by their code except "Others". 
                    // We always place "Others" to the end of list.
                    if (reason1.Reason.toLocaleLowerCase() === 'others') {
                        return 1;
                    } else if (reason2.Reason.toLocaleLowerCase() === 'others') {
                        return -1;
                    } else {
                        return reason1.Code - reason2.Code;
                    }
                });
        }
    }

    export class DataModelService {
        private _sketchData: SketchDataPri;

        constructor(private dataLoader: DataLoader, private $log: angular.ILogService, private $q: angular.IQService) {
            this._sketchData = new SketchDataPri();
        }
        
        public get currentDataCenterId(): string {
            return this._sketchData.currentDataCenterId;
        }

        public set currentDataCenterId(dataCenterId: string) {
            this._sketchData.currentDataCenterId = dataCenterId;
        }

        public get currentColoId(): string {
            return this._sketchData.currentColoId;
        }

        public set currentColoId(coloId: string) {
            this._sketchData.currentColoId = coloId;
        }

        public get selection(): RackSelection {
            if (angular.isUndefined(this._sketchData.rackTileSelection)) {
                this._sketchData.rackTileSelection = new RackSelection();
            }

            return this._sketchData.rackTileSelection;
        }

        public getDataCenterCatalogAsync(): angular.IPromise<DataCenterCatalog> {
            var deferred = this.$q.defer();

            var data = this._sketchData.cachedDataCenterCatalog;
            if (!data) {
                this.dataLoader.getDataCenterCatalogAsync()
                    .then((dataCenterCatalog: IDataCenterResult) => {
                        data = new DataCenterCatalog(dataCenterCatalog.DataCenters);
                        this._sketchData.cachedDataCenterCatalog = data;
                        deferred.resolve(data);
                    }, (error) => {
                        deferred.reject(error);
                    });
            } else {
                deferred.resolve(data);
            }

            return deferred.promise;
        }

        //@Cache('getTilesAsync')
        public getTilesAsync(coloId: string): angular.IPromise<ColoData> {
            var deferred = this.$q.defer();
            
            var data = this._sketchData.cachedColoData[coloId];
            if (!data) {
                this.dataLoader.getTilesAsync(coloId)
                    .then((coloData: IRawColoData) => {
                        data = new ColoData(coloData);
                        this._sketchData.cachedColoData[coloId] = data;
                        deferred.resolve(data);
                    }, (error) => {
                        deferred.reject(error);
                    });
            } else {
                deferred.resolve(data);
            }

            return deferred.promise;
        }

        public getGroupReservationsAtDataCenterAsync(dataCenterId: string): angular.IPromise<GroupReservationDataAtDataCenter> {
            var deferred = this.$q.defer();

            var data = this._sketchData.cachedGroupReservationsAtDataCenter[dataCenterId];
            if (!data) {
                this._retrieveReservationsForDataCenterAsync(dataCenterId)
                    .then((groupReservations: Array<IGroupReservation>) => {
                        data = new GroupReservationDataAtDataCenter(groupReservations);
                        this._sketchData.cachedGroupReservationsAtDataCenter[dataCenterId] = data;
                        deferred.resolve(data);
                    }, (error) => {
                        deferred.reject(error);
                    });
            } else {
                deferred.resolve(data);
            }

            return deferred.promise;
        }

        public getGroupRequestsAtDataCenterAsync(dataCenterId: number): angular.IPromise<GroupRequestsAtDataCenter> {
            var deferred = this.$q.defer();

            var data = this._sketchData.cachedGroupRequestAtDataCenter[dataCenterId];
            if (!data) {
                this.dataLoader.getGroupRequestForDataCenterAsync(dataCenterId.toString())
                    .then((groupRequests: IGroupRequestResult) => {
                        data = new GroupRequestsAtDataCenter(groupRequests);
                        this._sketchData.cachedGroupRequestAtDataCenter[dataCenterId] = data;
                        deferred.resolve(data);
                    }, (error) => {
                        deferred.reject(error);
                    });
            } else {
                deferred.resolve(data);
            }

            return deferred.promise;
        }

        public getIncidentReasonsAsync()
            : angular.IPromise<IncidentReasonsData> {
            var deferred = this.$q.defer();

            var data = this._sketchData.cachedIncidentReasons;
            if (!data) {
                this.dataLoader.getIncidentReasonsAsync()
                    .then((incidentReasons: any) => {
                        data = new IncidentReasonsData(incidentReasons);
                        this._sketchData.cachedIncidentReasons = data;
                        deferred.resolve(data);
                    }, (error) => {
                        deferred.reject(error);
                    });
            } else {
                deferred.resolve(data);
            }

            return deferred.promise;
        }

        public getIncidentsForDcAsync(dcName: string): angular.IPromise<{[groupId: string]: Array<IcmTicket>}> {
            var deferred = this.$q.defer()

            var data: {[groupId: string]: Array<IcmTicket>} = this._sketchData.cachedIncidentsForDc[dcName];
            if (!data) {
                this.dataLoader.getIncidentsForDcAsync(dcName)
                    .then((icmJson) => {
                        var ticketsForDc: { [groupId: string]: Array<IcmTicket> } = {};
                        if (icmJson.status != "success") {
                            deferred.reject(new AppError(KnownError.serviceCallFailure, `failed to retrieved data in getIncidentsForDcAsync(${dcName})`));
                        }
                        else {
                            for (var key in icmJson.tickets) { // for each groupId key in json
                                if (!icmJson.hasOwnProperty(key)) { // key is for metadata and not useful
                                    continue;
                                }

                                var ticketArrayJson = icmJson[key];
                                var length = ticketArrayJson.length;
                                if (!ticketsForDc[key]) {
                                    ticketsForDc[key] = [];
                                }
                                for (var i = 0; i < length; ++i) {
                                    ticketsForDc[key].push(new IcmTicket(ticketArrayJson[i]));
                                }

                            }
                            this._sketchData.cachedIncidentsForDc[dcName] = ticketsForDc;
                            deferred.resolve(ticketsForDc);
                        }
                    })
                    .catch((error) => {
                        deferred.reject(error);
                    });
            }
            else {
                deferred.resolve(data);
            }
            return deferred.promise;
        }

        public createIcmTicketAsync(ticketInfo: TicketCreationInfoModel): angular.IPromise<any> {
            var deferred = this.$q.defer();

            var response = this.dataLoader.createIcmTicketAsync(ticketInfo)
                .then((creationResponse) => {
                    // Do success things here
                    deferred.resolve(creationResponse);
                }, (error) => {
                    // Do failure things here
                    deferred.reject(error);
                });

            return deferred.promise;
        }


        //@Cache('getTilesAsync')
        public getSkuDetailByMsfPartNumberFromCache(msfPartNumber: number | string): ISkuDetails {
            var normalizedMsfPartNumber = normalizeMsfPartNumber(msfPartNumber);

            var data = this._sketchData.cachedMsfPartNumberToPowerRating[normalizedMsfPartNumber];

            if (data === undefined) {
                console.log(`Could not find cached value for msfPartNumber: ${msfPartNumber}`);
                return null;
            }
            
            return data;
        }

        public findAndCacheSkuDetailsByMsfPartNumbersAsync(msfPartNumbers: Array<number | string>)
            : angular.IPromise<boolean> {
            var deferred = this.$q.defer();

            var newMsfPartNumbers: Array<number> = [];

            msfPartNumbers.forEach((msfPartNumber) => {
                var normalizedMsfPartNumber = normalizeMsfPartNumber(msfPartNumber);

                if (this._sketchData.cachedMsfPartNumberToPowerRating[normalizedMsfPartNumber] === undefined) {
                    newMsfPartNumbers.push(normalizedMsfPartNumber);
                }
            });

            if (newMsfPartNumbers.length > 0) {
                this.dataLoader.getSkuDetailsByPartNumbersAsync(newMsfPartNumbers).then((skuDetailData: ISkuDetailData) => {
                    skuDetailData.SkuDetails.forEach((skuDetail: ISkuDetails) => {
                        this._sketchData.cachedMsfPartNumberToPowerRating[skuDetail.MsfId] = skuDetail; // cache
                    })
                    deferred.resolve(true /*succeeded*/);
                }, (error) => {
                    deferred.resolve(false /*succeeded*/);
                });
            }
            else {
                deferred.resolve(true /*succeeded*/);
            }

            return deferred.promise;
        }

        public getRackDataAtDataCenter(dataCenterId: number): angular.IPromise<RackDataAtDataCenter> {
            var deferred = this.$q.defer();

            var data = this._sketchData.cachedRacksAtColocation[dataCenterId];
            if (!data) {
                this.dataLoader.getRacksByDcIdAsync(dataCenterId)
                    .then((rackData: IRackData) => {
                        data = new RackDataAtDataCenter(rackData.Racks);
                        deferred.resolve(data);
                    }, (error) => {
                        deferred.reject(error);
                    });
            } else {
                deferred.resolve(data);
            }

            return deferred.promise;
        }

        /*
        Reservation Update Modules. Create/Delete/Verify Reservations
        */

        public CreatePreRackReservation(groupId: string, tileIds: Array<number>) {
            
        }

        public UpdatePreRackReservation(groupId: string, rackIds: Array<number>, overridePower: boolean=false, overrideCooling: boolean=false) {
            // Create ICM update ticket, sev 4
            // TODO(tmarkvluwer): implement here
            

            // Get TileIds
            var tiles: Array<ITileRect> = this.selection.racks; // TODO(tmarkvluwer): get list from pending list data, not current selection.
            var tileIds: Array<number> = []
            for (let tile of tiles) {
                tileIds.push(tile.originalTile.Id);
            }

            // Check that number of tiles matches # needed for group
            if (rackIds.length != tileIds.length) {
                throw(Error(`number of rackIds: ${rackIds.length} does not match number of tileIds: ${tileIds.length}`)); //make message better
            }

            // Check if we are re-assigning to the exact same tiles
            // TODO(tmarkvluwer): implement later. Not initially necessary

            // Check that tiles are available
            // TODO(tmarkvluwer): already implemented on backend. Not necessary yet

            // Check SPC requirements
            // TODO(tmarkvluwer): wait until tien is done with power feature

            // Create JSON object to pass to update_API
            var updateObj = {};
            updateObj['Updates'] = [];
            updateObj['Updates']['OverridePower'] = overridePower;
            updateObj['Updates']['OverrideCooling'] = overrideCooling;
            let len = rackIds.length;
            for (let i = 0; i < len; ++i) {
                let tileReserv: TileReservation = {
                    GroupId: groupId,
                    RackId: rackIds[i],
                    TileId: tileIds[i]
                };
                updateObj['Updates'].push(tileReserv);
            }

            // Send request to Server
            console.log(JSON.stringify(updateObj)); // TODO(tmarkvluwer): actually send the request
        }

        private _retrieveReservationsForDataCenterAsync(
            dataCenterId: string)
            : angular.IPromise<Array<IGroupReservation>> {
            return this.dataLoader.getGroupReservationsAtDataCenterAsync(dataCenterId)
                .then((data): Array<IGroupReservation> => {
                    var reservations: Array<IGroupReservation> = [];
                    data.GroupReservations.forEach((reservationItem) => {
                        var orders = [];
                        reservationItem.OrderReservations.forEach((orderItem) => {
                            var rackReservations = [];
                            orderItem.RackReservations.forEach((rackItem) => {
                                rackReservations.push({
                                    msfPartNumber: rackItem.MsfPartNumber,
                                    tileId: rackItem.TileId,
                                    rackId: rackItem.RackId,
                                    powerNeeded: rackItem.PowerNeeded,
                                    coolingReserved: rackItem.CoolingReserved
                                });
                            });

                            orders.push({
                                orderId: orderItem.OrderId,
                                rackReservations: rackReservations
                            });
                        });

                        reservations.push({
                            demandId: reservationItem.DemandId,
                            groupId: reservationItem.GroupId,
                            coloId: reservationItem.ColocationId,
                            type: reservationItem.Type,
                            lockType: reservationItem.LockType,
                            propertyGroupId: reservationItem.PropertyGroupId,
                            propertyGroupName: reservationItem.PropertyGroupName,
                            orders: orders
                        });
                    });

                    return reservations;
                });
        }

    }

    class SketchDataPri {
        public currentDataCenterId: string;
        public currentColoId: string;
        public cachedColoData: { [colodId: string]: ColoData } = {};
        public cachedDataCenterCatalog: DataCenterCatalog;
        public cachedGroupReservationsAtDataCenter: { [dataCenterId: string]: GroupReservationDataAtDataCenter } = {};
        public cachedGroupRequestAtDataCenter: { [dataCenterId: number]: GroupRequestsAtDataCenter } = {};
        public cachedMsfPartNumberToPowerRating: { [msfId: number]: ISkuDetails } = {};
        public cachedRacksAtColocation: { [coloId: number]: RackDataAtDataCenter } = {};
        public rackTileSelection: RackSelection;
        public cachedIncidentReasons: IncidentReasonsData;
        public cachedIncidentsForDc: { [dcName: string]: {[groupId: string]: Array<IcmTicket>} };
    }

}