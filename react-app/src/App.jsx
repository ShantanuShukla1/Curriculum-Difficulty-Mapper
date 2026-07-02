import { useEffect, useState } from 'react'
import { Box } from "@mui/material";
import './App.css'
import Tile from './Tile.jsx'

function App() {
  const [terms, setTerms] = useState([]);

  useEffect(() => {
    setTerms([[1,2,3],[4,5,6],[7,8,9]]);
  }, []);

  return (
    <Box sx={{
      display: "grid",
      justifyContent: "center",
      alignItems: "center",
      gridTemplateColumns: "repeat(3, 300px)",
      gridAutoRows: 200,
      gap: 2,
      padding: 4
    }}>
      {terms.map((col, colIndex) => col.map((val, rowIndex) => (
        <Box>
          <Tile className={`${rowIndex}-${colIndex}`} difficulty={val}/>
        </Box>
      )))}
    </Box>
  )
}

export default App
