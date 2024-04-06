export type DatasetCell =
  | string
  | number
  | boolean
  | null
  | object
  | (string | number | boolean | object)[];
export type DatasetRow = DatasetCell[];
export type Dataset = DatasetRow[];
