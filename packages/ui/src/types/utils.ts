/**
 * 工具类型定义
 */

// 深度可选类型
export type DeepOptional<T> = T extends object
  ? {
      [K in keyof T]?: DeepOptional<T[K]>;
    }
  : T;

// 深度必需类型
export type DeepRequired<T> = T extends object
  ? {
      [K in keyof T]-?: DeepRequired<T[K]>;
    }
  : T;

// 深度部分类型
export type DeepPartial<T> = T extends object
  ? {
      [K in keyof T]?: DeepPartial<T[K]>;
    }
  : T;

// 深度只读类型
export type DeepReadonly<T> = T extends object
  ? {
      readonly [K in keyof T]: DeepReadonly<T[K]>;
    }
  : T;

// 深度可写类型
export type DeepWriteable<T> = T extends object
  ? {
      -readonly [K in keyof T]: DeepWriteable<T[K]>;
    }
  : T;

// 深度Pick类型
export type DeepPick<T, K extends string> = T extends object
  ? {
      [P in keyof T as P extends K ? P : never]: DeepPick<T[P], K>;
    }
  : T;

// 深度Omit类型
export type DeepOmit<T, K extends string> = T extends object
  ? {
      [P in keyof T as P extends K ? never : P]: DeepOmit<T[P], K>;
    }
  : T;

// 深度NotNull类型
export type DeepNotNull<T> = T extends object
  ? {
      [K in keyof T]: DeepNotNull<T[K]>;
    }
  : NonNullable<T>;

// 深度Nullable类型
export type DeepNullable<T> = T extends object
  ? {
      [K in keyof T]: DeepNullable<T[K]> | null;
    }
  : T | null;

// 深度Undefined类型
export type DeepUndefined<T> = T extends object
  ? {
      [K in keyof T]: DeepUndefined<T[K]> | undefined;
    }
  : T | undefined;

// 深度NotNullAndUndefined类型
export type DeepNotNullAndUndefined<T> = T extends object
  ? {
      [K in keyof T]: DeepNotNullAndUndefined<T[K]>;
    }
  : NonNullable<T>;

// 深度Merge类型
export type DeepMerge<T, U> = T extends object
  ? U extends object
    ? {
        [K in keyof T | keyof U]: K extends keyof T & keyof U
          ? DeepMerge<T[K], U[K]>
          : K extends keyof T
          ? T[K]
          : K extends keyof U
          ? U[K]
          : never;
      }
    : T
  : U;

// 深度Intersect类型
export type DeepIntersect<T, U> = T extends object
  ? U extends object
    ? {
        [K in keyof T & keyof U]: DeepIntersect<T[K], U[K]>;
      }
    : never
  : U;

// 深度Union类型
export type DeepUnion<T, U> = T extends object
  ? U extends object
    ? {
        [K in keyof T | keyof U]: K extends keyof T & keyof U
          ? DeepUnion<T[K], U[K]>
          : K extends keyof T
          ? T[K]
          : K extends keyof U
          ? U[K]
          : never;
      }
    : T
  : U;

// 深度Exclude类型
export type DeepExclude<T, U> = T extends object
  ? U extends object
    ? {
        [K in keyof T as K extends keyof U ? never : K]: DeepExclude<T[K], U>;
      }
    : T
  : U extends T
  ? never
  : T;

// 深度Extract类型
export type DeepExtract<T, U> = T extends object
  ? U extends object
    ? {
        [K in keyof T as K extends keyof U ? K : never]: DeepExtract<T[K], U>;
      }
    : never
  : T extends U
  ? T
  : never;

// 深度Utility类型
export type DeepUtility<T, U> = T extends object
  ? {
      [K in keyof T]: U extends (value: T[K]) => infer R
        ? R
        : T[K];
    }
  : U extends (value: T) => infer R
  ? R
  : T;

// 路径字符串类型
export type PathString<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${PathString<T[K]>}`
          : `${K}`
        : never;
    }[keyof T]
  : never;

// 路径值类型
export type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends string
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;

// 可选路径值类型
export type OptionalPathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends string
      ? OptionalPathValue<T[K], Rest>
      : never
    : undefined
  : P extends keyof T
  ? T[P]
  : undefined;

// 路径存在类型
export type PathExists<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends string
      ? PathExists<T[K], Rest>
      : false
    : false
  : P extends keyof T
  ? true
  : false;

// 严格路径字符串类型
export type StrictPathString<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${StrictPathString<T[K]>}`
          : `${K}`
        : never;
    }[keyof T]
  : never;

// 嵌套键类型
export type NestedKeys<T> = T extends object
  ? {
      [K in keyof T]: K extends string | number
        ? T[K] extends object
          ? `${K}` | `${K}.${NestedKeys<T[K]>}`
          : `${K}`
        : never;
    }[keyof T]
  : never;

// 嵌套值类型
export type NestedValue<T, K extends string> = K extends `${infer FK}.${infer RK}`
  ? FK extends keyof T
    ? RK extends string
      ? NestedValue<T[FK], RK>
      : never
    : never
  : K extends keyof T
  ? T[K]
  : never;

// 函数参数类型
export type FunctionParams<T extends (...args: any[]) => any> = T extends (...args: infer P) => any
  ? P
  : never;

// 函数返回类型
export type FunctionReturn<T extends (...args: any[]) => any> = T extends (...args: any[]) => infer R
  ? R
  : never;

// 函数类型
export type FunctionType<T extends (...args: any[]) => any> = (...args: FunctionParams<T>) => FunctionReturn<T>;

// 异步函数返回类型
export type AsyncFunctionReturn<T extends (...args: any[]) => Promise<any>> = T extends (...args: any[]) => Promise<infer R>
  ? R
  : never;

// 类构造参数类型
export type ConstructorParams<T> = T extends new (...args: infer P) => any
  ? P
  : never;

// 类实例类型
export type ClassInstance<T> = T extends new (...args: any[]) => infer I
  ? I
  : never;

// 类静态类型
export type ClassStatic<T> = T extends new (...args: any[]) => any
  ? T
  : never;

// 挑选字符串属性
export type PickStringProperties<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};

// 挑选数字属性
export type PickNumberProperties<T> = {
  [K in keyof T as T[K] extends number ? K : never]: T[K];
};

// 挑选布尔值属性
export type PickBooleanProperties<T> = {
  [K in keyof T as T[K] extends boolean ? K : never]: T[K];
};

// 挑选函数属性
export type PickFunctionProperties<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K];
};

// 挑选对象属性
export type PickObjectProperties<T> = {
  [K in keyof T as T[K] extends object ? K : never]: T[K];
};

// 挑选数组属性
export type PickArrayProperties<T> = {
  [K in keyof T as T[K] extends any[] ? K : never]: T[K];
};

// 挑选Promise属性
export type PickPromiseProperties<T> = {
  [K in keyof T as T[K] extends Promise<any> ? K : never]: T[K];
};

// 挑选非空属性
export type PickNonNullableProperties<T> = {
  [K in keyof T as T[K] extends NonNullable<T[K]> ? K : never]: T[K];
};

// 挑选可读属性
export type PickReadonlyProperties<T> = {
  readonly [K in keyof T]: T[K];
};

// 挑选可写属性
export type PickWriteableProperties<T> = {
  -readonly [K in keyof T]: T[K];
};

// 挑选可选属性
export type PickOptionalProperties<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]: T[K];
};

// 挑选必需属性
export type PickRequiredProperties<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
};

// 挑选传类型
export type PickUnionProperties<T> = {
  [K in keyof T as T[K] extends infer U ? U extends T[K] ? never : K : never]: T[K];
};

// 挑选交集类型
export type PickIntersectionProperties<T> = {
  [K in keyof T as T[K] extends object ? (T[K] extends infer U ? U extends T[K] ? K : never : never) : never]: T[K];
};

// 挑选特类型
export type PickNeverProperties<T> = {
  [K in keyof T as T[K] extends never ? K : never]: never;
};

// 挑选未知类型
export type PickUnknownProperties<T> = {
  [K in keyof T as T[K] extends unknown ? K : never]: T[K];
};

// 挑选任意类型
export type PickAnyProperties<T> = {
  [K in keyof T as T[K] extends any ? K : never]: T[K];
};

// 挑选不包含类型
export type PickExcludeProperties<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

// 挑选提取类型
export type PickExtractProperties<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

// 挑选元组类型
export type PickTupleProperties<T> = {
  [K in keyof T as T[K] extends readonly any[] ? K : never]: T[K];
};

// 挑选非元组类型
export type PickNonTupleProperties<T> = {
  [K in keyof T as T[K] extends readonly any[] ? never : K]: T[K];
};

// 挑选枚举类型
export type PickEnumProperties<T> = {
  [K in keyof T as T[K] extends { [key: string]: string | number } ? K : never]: T[K];
};

// 挑选日期类型
export type PickDateProperties<T> = {
  [K in keyof T as T[K] extends Date ? K : never]: T[K];
};

// 挑选正则类型
export type PickRegexpProperties<T> = {
  [K in keyof T as T[K] extends RegExp ? K : never]: T[K];
};

// 挑选错误类型
export type PickErrorProperties<T> = {
  [K in keyof T as T[K] extends Error ? K : never]: T[K];
};

// 挑选类类型
export type PickClassProperties<T> = {
  [K in keyof T as T[K] extends new (...args: any[]) => any ? K : never]: T[K];
};

// 挑选原型类型
export type PickPrototypeProperties<T> = {
  [K in keyof T as T[K] extends { prototype: any } ? K : never]: T[K];
};

// 挑选键值对类型
export type PickKeyValueProperties<T> = {
  [K in keyof T as T[K] extends Record<string, any> ? K : never]: T[K];
};

// 挑选索引类型
export type PickIndexProperties<T, I extends string | number> = {
  [K in keyof T as T[K] extends Record<I, any> ? K : never]: T[K];
};

// 挑选拼接类型
export type PickPrefixProperties<T, P extends string> = {
  [K in keyof T as K extends P ? K : never]: T[K];
};

// 挑选后缀类型
export type PickSuffixProperties<T, S extends string> = {
  [K in keyof T as K extends `${infer First}${S extends infer Rest ? Rest : never}` ? K : never]: T[K];
};

// 挑选包含类型
export type PickContainsProperties<T, C extends string> = {
  [K in keyof T as K extends string ? (C extends K ? K : never) : never]: T[K];
};

// 挑选模式类型
export type PickPatternProperties<T, P extends string> = {
  [K in keyof T as K extends string ? (K extends P ? K : never) : never]: T[K];
};

// 挑选长度类型
export type PickLengthProperties<T, L extends number> = {
  [K in keyof T as K extends string ? (K extends { length: L } ? K : never) : never]: T[K];
};

// 挑选范围类型
export type PickRangeProperties<T, Min extends number, Max extends number> = {
  [K in keyof T as K extends number ? (K extends Min ? K extends Max ? K : never : never) : never]: T[K];
};

// 挑选满足类型
export type PickSatisfiesProperties<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

// 挑选不满足类型
export type PickNotSatisfiesProperties<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};