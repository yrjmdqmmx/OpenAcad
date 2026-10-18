OpenAcad 磁异常相关成像模拟示例

三份输入仅用于演示：磁异常曲线、海底和基底根据用户例图的可见形状手工重建并插值；测线经纬度为自定义模拟几何。它们不是原始观测，也不是吴招才等 2010 文献的原始数字化数据。

magnetic-curve.csv: dist_km 距离/km，mag_nT 磁异常/nT。
magnetic-profile.csv: s_km 沿线距离/km，bathy_m 海底高程/m（水下为负），basement_km 基底深度/km（向下为正）。
magnetic-track.json: OBS93.poly 点序列为 [经度,纬度]；首尾用于 WGS84 方位角。

相关成像结果由用户提供 Python 程序的棱柱磁场正演和窗口相关算法真实计算。相关系数不是概率、磁化率或确定的地质反演结果。
