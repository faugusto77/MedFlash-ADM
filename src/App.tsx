/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { DeckDetail } from './pages/DeckDetail';
import { CardCreator } from './pages/CardCreator';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="library" element={<Library />} />
          <Route path="deck/:id" element={<DeckDetail />} />
          <Route path="create" element={<CardCreator />} />
          <Route path="deck/:deckId/add" element={<CardCreator />} />
          <Route path="deck/:deckId/edit/:cardId" element={<CardCreator />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
