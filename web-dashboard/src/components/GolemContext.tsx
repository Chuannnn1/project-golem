"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { socket } from "@/lib/socket";

interface GolemContextType {
    activeGolem: string;
    setActiveGolem: (id: string) => void;
    golems: string[];
}

const GolemContext = createContext<GolemContextType>({
    activeGolem: "",
    setActiveGolem: () => { },
    golems: [],
});

export const useGolem = () => useContext(GolemContext);

export function GolemProvider({ children }: { children: React.ReactNode }) {
    const [golems, setGolems] = useState<string[]>([]);
    const [activeGolem, setActiveGolem] = useState<string>("");

    useEffect(() => {
        const fetchGolems = () => {
            fetch("/api/golems")
                .then(res => res.json())
                .then(data => {
                    if (data.golems && data.golems.length > 0) {
                        setGolems(data.golems);
                        setActiveGolem((currentActive) => {
                            if (!currentActive || !data.golems.includes(currentActive)) {
                                const saved = localStorage.getItem("golem_active_id");
                                if (saved && data.golems.includes(saved)) {
                                    return saved;
                                }
                                return data.golems[0];
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
                setGolems(data.golems);
                setActiveGolem(prev => {
                    if (!prev && data.golems.length > 0) return data.golems[0];
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

    return (
        <GolemContext.Provider value={{ activeGolem, setActiveGolem: handleSetGolem, golems }}>
            {children}
        </GolemContext.Provider>
    );
}
