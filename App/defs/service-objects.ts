// Copyright (c) Microsoft Corporation. All rights reserved
//  service-objects.ts
//  The definitions of the object model wrappers uesd by the service APIs

namespace SketchSvg {
    
    // Start: Create reservation Interfaces
    export interface PreRackReservationRequest {
        ReservationRequestId: string; // e.g. ReserveDemand-171690-6/21/2016 17:13:53
        Groups: Array<GroupReservationRequest>;
    }

    export interface GroupReservationRequest {
        CreationMethod: number;
        DemandId: number;
        GroupId: string;
        ColocationId: number;
        OverridePowerCheck: boolean;
        OverrideCoolingCheck: boolean;
        Orders: Array<OrderRequest>;
        MORReservationsRequest: MORReservationsRequest;
    }

    export interface OrderRequest {
        OrderId: number;
        RackReservations: Array<RackReservationRequest>;
    }

    export interface RackReservationRequest {
        MsfPartNumber: string;
        HwisRackId: string;
        TileId: number;
        PowerNeeded: number;
        CoolingNeeded: number;
    }

    export interface MORReservationsRequest {
        TileIds: Array<number>;
    }
    // End: create reservation interfaces

    // Start: Update Reservation Interfaces
    export interface ReservationManualUpdateRequest {
        ManualUpdateRequest: ManualReservationUpdateRequest;
        ColocationId?: number;
    }

    export interface ManualReservationUpdateRequest {
        OverrideCooling: boolean;
        OverridePower: boolean;
        GroupId: string;
        MORReservationUpdate: MORReservation;
        Updates: Array<RackLocationUpdateRequest>;
    }

    // TODO(tmarkvluwer): merge this with MORReservationsRequest
    // TODO(tmarkvluwer): Merge on backend with SPC and Resv Serv as well
    export interface MORReservation {
        TileIds: Array<number>;
    }

    export interface RackLocationUpdateRequest {
        GroupId: string;
        HwisRackId: string;
        RackId?: number;
        TileId: number;
    }
    // End: update reservation Interfaces

    // Start: delete reservation Interfaces
    export interface DeleteReservationRequest {
        Groups: Array<string>; // groupIds
    }
    // End: delete reservation Interfaces

    export interface TicketCreationInfoModel {
        UserId: string;
        DatacenterName: string;
        GroupId: string;
        DemandId: string;
        TicketBody: string;
        Code: number;
    }

    export interface ITileInfo {
        Name: string;
        X: string;
        Y: string;
        Id: number;
        PermittedBrand: string;
        Class: string;
        AssocDirection: string;
        Status: string;
    }

    export interface ColocationMetaData {
        OriginX: string;
        OriginY: string;
        XCordLength: number;
        YCordLength: number;
    }

    export interface OnboardingStatus {
        PowerOnboarded: boolean;
        TileOnboarded: boolean;
        CoolingOnboarded: boolean;
    }

    export interface Incident {
        Code: number;
        IncidentType: string;
        Reason: string;
        Scope: string;
        TicketAssignedTo: string;
    }

    export interface PerforatedTile {
        TileId: number;
        TileName: string;
        XCoordinates: string;
        YCoordinates: string;
        FloorType: string;
        TotalCapacity: number;
        ReservedCapacity: number;
        UsedCapacity: number;
    }

    // exact model of what is returned from GetPowerDevicesHierarchy
    // some fields are useless, and stupidly named
    // but maintaining their naming convention makes it easier to initialize
    export interface PowerInfo {
        XCoordinate: number;
        YCoordinate: number;
        PowerDeviceId: number;
        LocationId: number;
        LocationAssetId: number;
        Name: string;
        // PowerDeviceType: PowerDeviceType;
        PowerDeviceType: string; // should be of type PowerDeviceType, but that disables json auto construction
        MaxCapacity: number;
        ReservedPower: number;
        UsedPower: number;
        ParentPowerDeviceIds: Array<number>;
        PowerDevices: Array<PowerInfo>
    }

    export interface TileDataJson {
        "Status": number,
        "TilePurpose": number,
        "TileType": number,
        "PowerDeviceId": number,
        "Id": number,
        "Name": string,
        "XCoordinate": string,
        "YCoordinate": string // which is usually a number
    }

    export interface TileReservation {
        GroupId: string,
        RackId: number,
        TileId: number
    }

    export interface CreatePreRackReservationRequest {
        Groups: Array<PreRackGroupReservationRequest>;
        ReservationRequestId: string; // e.g. ReserveDemand-171690-6/21/2016 17:13:53
    }

    export interface PreRackGroupReservationRequest {
        Brand: string,
        CreationMethod: ReservationCreationMethod, // number/enum
        DemandID: number,
        GroupId: string,
        GroupLocationId: number,
        ColocationId: number,
        LockType: ReservationLockType, // number/enum
        Orders: Array<PreRackOrderReservationRequest>,
        MORReservationsRequest: PreRackMORReservationRequest,
        OverridePowerCheck: boolean,
        OverrideCoolingCheck: boolean,
        PropertyGroupId: number,
        PropertyGroupName: string,
        RtegDate: string,
        SecurityClassification: string,
        Status: number, // Really a Demand Status
        Type: number // TODO(tmarkvluwer): no idea what this is for
    }

    export interface PreRackOrderReservationRequest {
        OrderId: number,
        RackReservations: Array<PreRackRackReservationRequest>
    }

    export interface PreRackRackReservationRequest {
        HwisRackId: string,
        MSFPartNumber: string,
        PowerNeeded: number,
        CoolingNeeded: number,
        TileId: number
    }

    export interface PreRackMORReservationRequest {
        TileIds: number;
    }

    export interface IBuildingCoordinates {
        "DCNm": string; //"Boydton BN6"
        "DC": string; // "Boydton BN6"
        "DCwid": number; // 2000, does not appear to be used. Same for all Colos I have observed
        "DCHt": number; // 2000, does not appear to be used. Same for all Colos I have observed
        "SLx": number; // 500, does not appear to be used. Same for all Colos I have observed
        "SLy": number; // 500, does not appear to be used. Same for all Colos I have observed
        "SShape": string; // "4{(0;0)(0,4000)(4000,4000)(4000,0)(0,0)}" // todo(): find out what this is, does not appear to be used. Same for all Colos I have observed
        "BID": number; // 78054986
        "BName": string; // "AZA"
        "BLx": number; // 1000
        "BLy": number; // 376
        "BWid": number; // 2752
        "BHt": number; // 1152
        "Roof": number; // 0, does not appear to be used. Same for all Colos I have observed
        "Rota": number; // 0, does not appear to be used. Same for all Colos I have observed
        "DrwOr": number; // 500
        "BClr": string; // "D1D1D1"
        "FColor": string; // "FFFFFF"
        "Type": string; // "Colo" // TODO(): should be an enum
        "Horz": string; // "Right" // TODO: should be an enum
        "Vert": string; // "Bottom" // TODO: should be an enum
        "BgRm": number; // 1, null TODO: not sure what this is for
        "StCol": string; // "AA", starting col for the building, can also be gotten from GetStatusTiles
        "StRow": number; // 0, starting row for the building, can also be gotten from GetStatusTiles
        "RbyN": number; // 0, TODO: not sure what this is for
        "MDCID": number; // 66844116, same as the dcId
        "MCoID": number; // 78054986, same as coloId
        "LabY_P": number; // 0, TODO: not sure what for
        "LabX_P": number; // 0, TODO: not sure what for
        "NWal": number; // 0, TODO: not sure what for
    }

    export enum TileStatus { // todo(tmarkvluwer): find all possible
        AVAILABLE, // tile is available, and suitable for racks
        RESERVED, // tile is reserved to have rack built on it
        IN_USE, // tile already has rack built on it
        NON_DEPLOYABLE // tile is used for walkway, or hot/cold aisle
    }

    export enum TilePurpose { // todo(tmarkvluwer): find all possible
        NA,
        SERVER,
        MOR,
        CNR,
        MDF,
        IDF,
        NETWORK
    }

    export enum TileType { // todo: find all possible
        HOT_AISLE,
        COLD_AISLE,
        INFRASTRUCTURE,
        WALKWAY,
        SECOND_TILE,
        BUILDABLE // TODO: is this a real type??
    }

    export enum PowerDeviceType {
        ColoITCapacity,
    }

    export enum ColoFloorType {
        CONCRETE,
        RAISED
    }

    export enum OrderStatus {
        Draft,
        Signal,
        CapacityApproved,
        Pipeline,
        Deployed,
        Cancelled,
        Expired,
        Planning,
        PlanningApproved,
        PlanningApprovedPassThrough
    }

    export enum DemandType { // todo: find all possible values for this enum
        Rack,
        Server
    }

    // measure of the importance of the business impact
    export enum SecurityClassification {
        LBI,
        MBI,
        HBI
    }

    export enum RequestFulfillmentStatus {
        Success,
        Failure,
        Wait,
        SpcApproved
    }

    export enum ReservationAction {
        Preliminary,
        Final,
        Canceled
    }

    export enum ReservationStatus {
        Created,
        Approved,
        Escalated
    }

    export enum ReservationLockType {
        Soft,
        Hard
    }

    export enum ReservationCreationMethod {
        System,
        Manual,
        Onboarded
    }

    export enum DeviceType {
        Chassis,
        Container,
        Drivebay,
        HBA,
        NetworkDevice,
        PowerStrip,
        Rack,
        RMD,
        San,
        SanController,
        SanSwitch,
        Server,
        TapeBackup,
        Reservation
    }

    export interface IDataCenterAndColoInfo {
        Id: string;
        Name: string;
        Colocations: Array<IColocation>;
    }

    export interface IColocation {
        Id: string;
        Name: string;
        parentId?: string;
        parentName?: string;
    }

    export interface ISkuDetailData {
        SkuDetails: Array<ISkuDetails>;
    }

    export interface ISkuDetails {
        MsfId: number,
        SkuPowerAt100pctLoadW: number
    }

    export interface IRackData {
        Racks: Array<IRack>;
    }

    export interface IRack {
        Name: string,
        RackId: number,
        RackSize: number,
        Tile: string,
        ColocationId: number,
        DatacenterId: number,
        PowerConsumed: number

    }

    export interface IDataCenter {
        id: string;
        name: string;
    }

    export interface IDataCenterResult {
        DataCenters: IDataCenterAndColoInfo[];
    }

    export interface ILocation {
        DataCenterId: string;
        ColocationId: string;
    }

    export interface IOrder {
        Id: string;
        MsfPartNumber: string;
        SkuCount: number;
        SkuType: string;
        RackIds: number[];
    }

    export interface IGroupRequest {
        Id: string;
        CreationDate: string;
        Location: ILocation;
        DemandId: number;
        ReservationAction: string;
        FulfillmentStatus: string;
        Message: string;
        LockType: string;
        Orders: IOrder[];
        orderDescription?: string;
        isVisible?: boolean;
    }

    export interface IGroupRequestResult {
        GroupRequests: IGroupRequest[];
    }

    export interface IncidentReason {
        Code: number;
        IncidentType: string;
        Reason: string;
        Scope: string;
        TicketAssignedTo: string;
    }

    export interface IIcmIncidentReasons {
        Reasons: Array<IncidentReason>;
    }

    export enum SkyuType {
        PreRack,
        Discrete
    }
}