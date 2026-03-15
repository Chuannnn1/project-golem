"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    data?: any[];
    dataKey?: string;
    color?: string;
}

export function MetricCard({ title, value, icon: Icon, data, dataKey, color = "#8884d8" }: MetricCardProps) {
    return (
        <Card className="bg-card border-border text-foreground shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 text-muted-foreground">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {data && data.length > 0 && (
                    <div className="h-[80px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <Tooltip
                                    contentStyle={{ 
                                        backgroundColor: "var(--color-popover)", 
                                        borderColor: "var(--color-border)",
                                        borderRadius: "var(--radius-md)"
                                    }}
                                    itemStyle={{ color: "var(--color-popover-foreground)" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={dataKey || "value"}
                                    stroke="var(--color-primary)"
                                    fill="var(--color-primary)"
                                    fillOpacity={0.2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
