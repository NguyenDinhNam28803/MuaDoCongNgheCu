export class InvalidTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Không cho phép chuyển trạng thái ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class InspectionGateError extends Error {
  constructor(reason: string) {
    super(`Không qua cổng kiểm định: ${reason}`);
    this.name = "InspectionGateError";
  }
}

/** Máy vừa bị người khác thay đổi (compare-and-set cập nhật 0 dòng). */
export class DeviceConflictError extends Error {
  constructor(readonly deviceId: string) {
    super(`Máy ${deviceId} vừa được thay đổi bởi thao tác khác, vui lòng tải lại`);
    this.name = "DeviceConflictError";
  }
}
