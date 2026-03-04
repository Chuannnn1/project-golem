"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { socket } from "@/lib/socket";

interface GolemInfo {
    id: string;
    status: string;
}

interface GolemContextType {
    activeGolem: string;
    activeGolemStatus: string;
    setActiveGolem: (id: string) => void;
    golems: GolemInfo[];
}

const GolemContext = createContext<GolemContextType>({
    activeGolem: "",
    activeGolemStatus: "running",
    setActiveGolem: () => { },
    golems: [],
});

export const useGolem = () => useContext(GolemContext);

export function GolemProvider({ children }: { children: React.ReactNode }) {
    const [golems, setGolems] = useState<GolemInfo[]>([]);
    const [activeGolem, setActiveGolem] = useState<string>("");

    useEffect(() => {
        const fetchGolems = () => {
            fetch("/api/golems")
                .then(res => res.json())
                .then(data => {
                    if (data.golems && data.golems.length > 0) {
                        setGolems(data.golems);
                        setActiveGolem((currentActive) => {
                            const ids = data.golems.map((g: GolemInfo) => g.id);
                            if (!currentActive || !ids.includes(currentActive)) {
                                const saved = localStorage.getItem("golem_active_id");
                                if (saved && ids.includes(saved)) {
                                    return saved;
                                }
                                return data.golems[0].id;
                            }
                            return currentActive;
                        });
                    } else {
                        setGolems([]);
                        setActiveGolem("");
                    }
                })
                .catch(err => console.error("Failed to fetch golems", err));
        };

        // Fetch initially via REST
        fetchGolems();

        // Socket updates 
        const handleInit = (data: any) => {
            if (data.golems) {
                // If it's a string array (backward compatibility), map it to objects.
                // Assuming the new backend sends {id, status} array:
                const formattedGolems = typeof data.golems[0] === 'string'
                    ? data.golems.map((id: string) => ({ id, status: 'running' }))
                    : data.golems;

                setGolems(formattedGolems);
                setActiveGolem(prev => {
                    if (!prev && formattedGolems.length > 0) return formattedGolems[0].id;
                    return prev;
                });
            }
        };

        const handleConnect = () => {
            // When socket reconnects (e.g. after backend restart), refetch golems
            fetchGolems();
        };

        socket.on("init", handleInit);
        socket.on("connect", handleConnect);

        return () => {
            socket.off("init", handleInit);
            socket.off("connect", handleConnect);
        };
    }, []);

    // Save choice
    const handleSetGolem = (id: string) => {
        setActiveGolem(id);
        localStorage.setItem("golem_active_id", id);
    };

    const activeGolemObj = golems.find((g: GolemInfo) => g.id === activeGolem);
    const activeGolemStatus = activeGolemObj?.status || "running";

    return (
        <GolemContext.Provider value={{ activeGolem, activeGolemStatus, setActiveGolem: handleSetGolem, golems }}>
            {children}
        </GolemContext.Provider>
    );
}
