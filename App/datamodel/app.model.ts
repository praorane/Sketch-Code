/// <reference path="../defs/service-objects.ts" />
/// <reference path="enums.ts" />
//import {User} from './user.model'
//import {Datacenter} from './datacenter.model'

namespace SketchSvg {
    'use strict';

    export enum ReservationType {
        Preliminary,
        Final
    }

    export interface Asset {
        getAssetId(): number;
        getAssetName(): string;
        getAssetTag(): number;
    }

    export class Building {
        constructor(
            private _name: string,
            private _assetId: number,
            private _dcId: number,
            private _powerInfo: PowerInfo, // gotten from DataLoader.getPowerInfoByAssetIdAsync(this._assetId, this._dcId);
            private _coolingInfo: CoolingInfo // gotten from DataLoader.getCoolingInfoByAssetIdAsync(this._assetId, this._dcId);
        ) {
        }
    }

    export interface CoolingInfo {
        ColoCooling: ColoCoolingInfo;
        AisleCooling: Array<AisleCoolingInfo>;
    }

    export interface ColoCoolingInfo {
        ColoCoolingId: number;
        // ColocationFloorType: ColoFloorType;
        ColocationFloorType: string; // todo: should be type (ColoFloorType) enum, but that disables auto construction from json
        TotalCapacity: number;
        ReservedCapacity: number;
        UsedCapacity: number;
    }

    // todo: give perforatedTiles array a real type
    export interface AisleCoolingInfo {
        AisleId: number;
        TotalCapacity: number;
        ReservedCapacity: number;
        UsedCapacity: number;
        PerforatedTiles: Array<PerforatedTile>;
    }

    // full implementation of Colocation
    // with all submembers.
    export class Colocation {
        private _height: number; // in tiles, gotten from GetTileStatus.metadata.YCordLength
        private _width: number; // in # of rows (aka tiles), gotten from GetTileStatus.metadata.XCordLength
        private _originX: string;
        private _originY: number;

        constructor(
            private _assetId: number,
            private _name: string,
            private _dcId: number,
            private _onboardingStatus?: OnboardingStatus,
            private _spaceId?: number, // gotten from GetTileStatus.metadata.coloSpaceId
            private _buildingCoordinates?: IBuildingCoordinates, // gotten from Sketch_CanvasItems // TODO: not initialized yet
            private _tiles?: Array<Tile>, // gotten from GetStatusTiles
            metaData?: ColocationMetaData
        ) {
            
        }

        get onboardingStatus(): OnboardingStatus {
            return this._onboardingStatus;
        }

        get height(): number {
            return this._height;
        }

        get width(): number {
            return this._width;
        }

        get buildingCoordinates(): IBuildingCoordinates {
            return this._buildingCoordinates;
        }

        get tiles(): Array<Tile> {
            return this._tiles;
        }

        get originX(): string {
            return this._originX;
        }

        get originY(): number {
            return this._originY;
        }

        // getters
        get name(): string {
            return this._name;
        }

        get assetId(): number {
            return this._assetId;
        }
    }

    export class DiscreteReservation {
        constructor(
            private _coloName: string, // name of the colo which reservation belongs to, todo: redundant info...
            private _dcId: number, // datacenter which this belongs to, todo: redundant info...
            private _devices: Array<DiscreteDevice>,
            private _rackName: string // todo: not sure if this discrete is required to go in a certain rack
        ) { }
    }

    export class DiscreteDevice {
        constructor(
            private _reservationId: number, // gotten from unnamed field inside of colo from GetDiscreteReservationAtDatacenter API call
            private _orderId: number,
            private _groupId: string,
            private _slot: number, // gotten from 'S' from GetDiscreteReservationAtDatacenter
            private _deviceType: number, // TODO: should this be enum?, gotten from 'T' from GetDiscreteReservationAtDatacenter
            private _uCount: number, // number of vertical slots in a rack, gotten from 'U' from GetDiscreteReservationAtDatacenter
            private _assetTag: string, //  gotten from 'Tg' from GetDiscreteReservationAtDatacenter
            private _year: number, // gotten from 'Yr' from GetDiscreteReservationAtDatacenter
            private _month: number, // gotten from 'Mn' from GetDiscreteReservationAtDatacenter
            private _watts: number, // gotten from 'P' from GetDiscreteReservationAtDatacenter
            private _propertyGroup: string // TODO: not sure what type, or what object is for, gotten from 'PG' from GetDiscreteReservationAtDatacenter
        ) { }
    }

    // gotten from http://sketch/php1/Ticket_GetTicketsForDC.php?dcName=Quincy MWH01
    // response like "tickets":{"00000000-0000-0000-0000-000000000000":["17120131"]}
    export class IcmTicket {
        constructor(private _id: number) { }

        get id(): number {
            return this._id;
        }

        public getTicketLink() {
            return `https://icm.ad.msft.net/imp/IncidentDetails.aspx?id=${this._id}`;
        }
    }

    export class MsTicket {
        private static c_NETWORK_TITLE = "Network - Final reservation request received at Data center";
        private static c_DC_ACTION_TITLE = "FINAL RESERVATION request received at Data center";
        

        private _created: Date;
        private _modified: Date;
        private _teamAssignedName: string; // e.g. Test Capacity Reservation
        private _id: number; // e.g. 7715227
        private _dcId: number; // same as dcId for Datacenter object, todo: redundant
        private _dcName: string; // same as dcName for Datacenter object
        private _createdBy: string;
        private _externalRefId: string; // same as the groupId for the group it is related to. Called 'ExternalReferenceId' in json reponse
        private _title: string; // title of the ticket
        private _status: string; // A or C for active or closed

        constructor(created: Date, modified: Date, teamAssigned: string, id: number,
            dcId: number, dcName: string, createdBy: string, groupId: string, title: string, status: string) {

        }

        public isNetworkTicket(): boolean {
            return this._title.indexOf(MsTicket.c_NETWORK_TITLE) > -1;
        }

        public isFinalReservationRequest(): boolean {
            return this._title.indexOf(MsTicket.c_DC_ACTION_TITLE) > -1;
        }

        public isActive() {
            return this._status == 'A';
        }
    }

    export class ReservationGroup {
        constructor(
            private _groupId: string,
            private _status: string,
            private _orders: Array<Order>
        ) { }

        get groupId(): string {
            return this._groupId;
        }
    }

    export class Demand {
        constructor(
            private _demandId: number, // gotten from MSPod_ListPull
            private _creationMethod: ReservationCreationMethod,
            private _reservationType: ReservationType,
            private _lockType: ReservationLockType,
            private _propertyGroup: string, // "Azure Compute US", appears as 'Prop' in MSPod_ListPull
            private _propertyGroupId: number, // appears to be an ID for the property group
            private _rteg: Date, // RTEG date where project is supposed to "go live"
            private _securityClassification: SecurityClassification,
            private _coloId: number, // same as coloId which this project belongs to. appears as 'RMAsId' in MSPod_ListPull
            private _brand: string,
            private _groups: Array<ReservationGroup> // GroupIds 
        ) {
            if (this._groups == null) {
                this._groups = [];
            }
        }

        get id(): number { return this._demandId; }
        get groups(): Array<ReservationGroup> { return this._groups; }
        get propertyGroup(): string { return this._propertyGroup; }

        public addGroup(group: ReservationGroup) {
            this._groups.push(group);
        }
    }

    export class Group {
        constructor(
            private _groupId: string, // gotten from MSPod_ListPull
            private _orders: Array<Order>, // todo: can there be multiple Orders for one group?
            private _demandType: DemandType, // is this a rack or a server? appears in MSPod_ListPull as 'DTyp', todo: should this be within demand object?
            private _demandCount: number, // Number of racks or servers within the group demand. appears in MSPod_ListPull as 'TCnt'
            private _requestStatus: RequestFulfillmentStatus
            //private _orderStatus: OrderStatus // appears in MSPod_ListPull as 'OSat' todo: seemingly no longer used.
        )
        {}

        get groupId(): string { return this._groupId; }
        get count(): number { return this._demandCount; }
        get demandType(): DemandType { return this._demandType; }
        get requestStatus(): RequestFulfillmentStatus { return this._requestStatus; }
    }

    export class Order { // gotten from MSPod_ListPull
        constructor(
            private _orderId: number,
            private _count: number,
            private _rackReservations: Array<RackReservation>
            //private _spApr: any, // todo: what is this used for? Appears to always be null.
            //private _skID: string, // todo: Document what this value is
            //private _oType: string, // Network, todo: looks like it should be an enum, TODO: find out what this value is
            //private _watts: number // 2272, todo: document this. Appears to be watts consumed by the sku
        )
        {}

        get orderId(): number { return this._orderId; }
    }

    export class RackReservation {
        constructor(
            private _msfPartNumber: string,
            private _rackId: number,
            private _tileId?: number
            //private _tiles: Array<Tile>;
            //private _powerNeeded: number;
            //private _coolingContainmentAisleId: number; // corresponds to aisleId
            //private _coolingReserved: number;
            //private _perforatedTiles: Array<PerforatedTile>;
        ) { }
    }

    export class GroupRequest {
        groupId: string;
        creationDate: Date;
        dcId: number;
        coloId: number;
        demandId: number;
        reservationAction: ReservationAction;
        fulfillmentStatus: RequestFulfillmentStatus;
        message: string;
        orders: Array<Order>;
    }

    //export class Reservation {
    //    private _groupId: string;
    //    private _demandId: number;
    //    private _propertyGroupId: number;
    //    private _propertyGroupName: string;
    //    private _rtegDate: Date;
    //    private _status: ReservationStatus; // todo: not positive this is actually a reservation status
    //    private _lockType: ReservationLockType; // hard vs soft
    //    private _creationType: ReservationCreationMethod; // e.g. system
    //    private _reservationType: ReservationType;
    //    private _orders: Array<Order>;
    //}

    //export interface GroupRequestStatus {
    //    groupId: string; // same as groupId which status belongs to, redundant
    //    requestFulfillmentStatus: RequestFulfillmentStatus; // e.g. Success
    //    message: string;
    //    dcId: number; // same as housing dcId, redundant
    //    creationDate: Date;
    //    modificationDate: Date;
    //    demandId: number;
    //    reservationAction: ReservationAction; // e.g. Preliminary
    //    forceReplanGroup: boolean;
    //    isGroupUpdated: boolean; // not sure what this is used for
    //    propertyGroupId: number; // not sure if this is used
    //    propertyGroupName: string; // not sure if this is used
    //    requestedRteg: Date;
    //    securityClassification: SecurityClassification; // not sure if used
    //    location: Location;
    //}

    export interface Location {
        regionId: number;
        countryId: number;
        metroId: number;
        campusId: number;
        dcId: number;
        coloId: number; // not sure if used
        rowId: number; // not sure if used
        locationId: number; // not sure if used
    }

    export interface PowerDevice {
        getPowerConsumption(): number;
        getWattsBudget(): number; // todo(tmarkvluwer): not sure what this is
        getWattsAllocated(): number;
        getWattsActual(): number;
        getLastUpdated(): Date;
    }

    export class Rack implements PowerDevice, Asset {
        private _slots: Array<Server>; // todo: not sure where to get this data from
        private _size: number; // gotten from GetRackDataByDc
        private _name: string; // e.g. BY1F02C01-EU061, gotten from GetRackDataByDc
        private _id: number; // gotten from GetRackDataByDc
        private _tile: string; // e.g. EU061, tileName of the tile which houses the rack, gotten from GetRackDataByDc
        private _coloId: number; //gotten from GetRackDataByDc
        private _dcId: number; // gotten from GetRackDataByDc
        private _powerConsumed: number; // gotten from GetRackDataByDc


        getAssetId(): number { return null; }
        getAssetName(): string { return null; }
        getAssetTag(): number { return null; }

        getPowerConsumption(): number { return null; }
        getWattsBudget(): number { return null; }
        getWattsAllocated(): number { return null; }
        getWattsActual(): number { return null; }
        getLastUpdated(): Date { return null; }
    }

    export class Row {
        private _name: string; // e.g.CB
        private _length: number;
        private _tiles: Array<Tile>;



        //getters
        get name(): string {
            return this._name;
        }

        containsTile(tileName: string): boolean {
            return this.getTileByName(tileName) != null;
        }

        getTileByName(tileName: string): Tile {
            var tiles = this._tiles.filter((tile) => { return tile.name == tileName });
            if (tiles.length) { return tiles[0]; }
            else { return null; }
        }
    }

    export class Server implements Asset, PowerDevice {
        private _propertyGroup: any; // todo: not sure of the type // gotten from GetRackDataByDc
        private _created: Date; // gotten from GetRackDataByDc
        private _id: number; // gotten from GetRackDataByDc TODO: not sure which type of Id this is? Asset Id?
        private _itemType: DeviceType; // e.g. NetworkDevice // gotten from GetRackDataByDc
        private _slotNumber: number; // the slot of the rack which this server lives in // gotten from GetRackDataByDc
        private _assetUCount: number; // todo: not sure what this is // gotten from GetRackDataByDc
        private _assetTag: number; // gotten from GetRackDataByDc
        private _name: string; // e.g. bay-n7f-cps-1a     // gotten from GetRackDataByDc
        private _powerRating: number;

        // TODO: Not sure where to get this data from
        private _assetId: number;
        private _assetName: string;
        private _wattsBudget: number;
        private _wattsAllocated: number;
        private _wattsActual: number;
        private _powerModified: Date;

        private _size: number; // number of slots it takes up
        private _startingSlot: number; // lowest slot # it takes up. e.g. if it takes 14-17, then startingSlot == 14

        getAssetId(): number { return this._assetId; }
        getAssetName(): string { return this._assetName; }
        getAssetTag(): number { return this._assetTag; }
        getPowerConsumption(): number { return null; }
        getWattsBudget(): number { return null; }
        getWattsAllocated(): number { return null; }
        getWattsActual(): number { return null; }
        getLastUpdated(): Date { return null; }
    }

    export class Tile {
        private _dcId: number;
        private _coloId: number;
        private _name: string; // e.g. BX223, gotten from GetStatusTiles
        private _id: number; // TODO: what kind of ID is this? Asset ID?, gotten from GetStatusTiles
        private _status: TileStatus; // , gotten from GetStatusTiles
        private _purpose: TilePurpose; // , gotten from GetStatusTiles
        private _type: TileType; // , gotten from GetStatusTiles
        private _containmentAisleId: number; // TODO: not sure where to get from, or if needed // TODO not initialized
        private _powerDeviceId: number; // TODO: tmarkvluwer, not sure what this is. Could be PowerDeviceType or DeviceType
        private _xCoord: string; // e.g. BX, same as parent row name, gotten from GetStatusTiles
        private _yCoord: number; // e.g. 223, gotten from GetStatusTiles

        // populated from a TileDataJson object
        constructor(
            tileData: TileDataJson,
            coloId: number,
            dcId: number
        ) {
            this._dcId = dcId;
            this._coloId = coloId;
            this._name = tileData.Name;
            this._id = tileData.Id;
            this._status = tileData.Status;
            this._purpose = tileData.TilePurpose;
            this._type = tileData.TileType;
            this._powerDeviceId = tileData.PowerDeviceId;
            this._xCoord = tileData.XCoordinate;
            this._yCoord = parseInt(tileData.YCoordinate);
        }

        // getters
        get xCoord(): string { return this._xCoord; }
        get yCoord(): number { return this._yCoord; }
        get name(): string { return this._name; }
        get status(): TileStatus { return this._status; }
        get purpose(): TilePurpose { return this._purpose; }

        // setters
        // (at this time most attributes should be set in constructor, not manually)
        set status(status: TileStatus) { this._status = status; }
    }

    export class User {
        private _userGroups: Array<string>;

        constructor(private _username: string) { }
    }
}
