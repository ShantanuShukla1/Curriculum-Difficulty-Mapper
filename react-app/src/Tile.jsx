import { Box, Paper, Stack, Typography } from "@mui/material";

export default function Tile({className, difficulty}){

    return (
        <Paper sx={{
            width: 300, 
            height: 200, 
            position: "relative"
        }}>
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
    )

}