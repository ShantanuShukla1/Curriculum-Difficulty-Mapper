import { useState } from "react";
import { Box, ClickAwayListener, Paper, Stack, Tooltip, Typography } from "@mui/material";

export default function Tile({className, difficulty}){
    const [open, setOpen] = useState(false);

    const tooptipToggle = () => setOpen((prev) => !prev);
    const tooltipClose = () => setOpen(false);

    return (
        <ClickAwayListener onClickAway={tooltipClose}>
            <Tooltip
             title="Class Info"
             open={open}
             onClose={tooltipClose}
             disableFocusListener
             disableHoverListener
             disableTouchListener
             arrow
            >
                <Paper
                 onClick={tooptipToggle} 
                 sx={{
                    width: 300, 
                    height: 200, 
                    position: "relative",
                    backgroundColor: "white",
                    transition: "background-color 0.5s ease, transform 0.5s ease",
                    "&:hover": {
                        backgroundColor: "#ffffbf",
                        transform: "translateY(-4px)"
                    }
                 }}
                >
                    <Typography
                     variant="h4"
                     sx={{
                        color: "black", 
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        position: "absolute",
                        top: "5%", 
                        left: "50%",
                        transform: "translateX(-50%)"
                    }}>
                        {className}
                    </Typography>
                    <Box sx={{
                        width: 80, 
                        height: 80, 
                        borderRadius: "50%", 
                        backgroundColor: "black", 
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)"
                    }}>
                        <Typography variant="h4" sx={{color: "white"}}>{difficulty}</Typography>
                    </Box>
                </Paper>
            </Tooltip>
        </ClickAwayListener>
        
    )

}