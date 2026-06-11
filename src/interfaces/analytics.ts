export interface GetAnalyticsEventInput {
  limit?: number;
  offset?: number;
  isBlocked?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface GetTimeseriesInput {
  interval?: string;
  startDate?: string;
  endDate?: string;
}

export interface GetTopBlockedInput {
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface GetPatternsInput {
  startDate?: string;
  endDate?: string;
}

export interface GetEndpointsInput {
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface GetStatusCodesInput {
  startDate?: string;
  endDate?: string;
}

export interface GetIpAddressesInput {
  limit?: number;
  startDate?: string;
  endDate?: string;
}
