
import React, { useState, useEffect } from 'react';
import { generateEDL, generateResolveXML, generateCSV } from '../services/exportService';
import { generateId } from '../services/utils';
import { Comment, CommentStatus } from '../types';
import { ArrowLeft, CheckCircle, XCircle, Play, RefreshCw } from 'lucide-react';

// --- HELPERS FOR TESTING ---
const assert = (name: string, condition: boolean, details?: string) => {
    return { name, passed: condition, details };
};

// --- MOCK DATA ---
const mockComments: Comment[] = [
    {
        id: 'c1',
        userId: 'u1',
        text: 'Fix color',
        timestamp: 10.5, // 10.5 sec * 24 fps = ~252 frames
        status: CommentStatus.OPEN,
        createdAt: 'now'
    },
    {
        id: 'c2',
        userId: 'u2',
        text: 'Cut here',
        timestamp: 60.0, // 1 min exactly
        duration: 2.0,   // 2 sec duration
        status: CommentStatus.RESOLVED,
        createdAt: 'now'
    }
];

export const TestRunner: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [results, setResults] = useState<{name: string, passed: boolean, details?: string}[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const runTests = async () => {
        setIsRunning(true);
        setResults([]);
        
        // Simulating delay for effect
        await new Promise(r => setTimeout(r, 500));

        const newResults = [];

        // 1. TEST TIMECODE MATH (Internal logic of EDL generation)
        // We test the output of generateEDL implicitly
        const edlOutput = generateEDL('TestProject', 1, mockComments, 24);
        
        // Check 1: Header existence
        newResults.push(assert('EDL: Contains Header', edlOutput.includes('TITLE: TestProject_v1 Markers')));
        
        // Check 2: Timecode Calculation (10.5s @ 24fps)
        // 10.5 * 24 = 252 frames. 
        // 252 / 24 = 10 sec, remainder 12 frames. -> 00:00:10:12
        newResults.push(assert('EDL: Correct Timecode (10.5s @ 24fps)', edlOutput.includes('00:00:10:12'), 'Expected 00:00:10:12 in output'));

        // Check 3: Range Comment Duration
        // c2 is 60s start, 2s dur. 
        // Start: 00:01:00:00. End: 00:01:02:00.
        newResults.push(assert('EDL: Range Duration Calculation', edlOutput.includes('00:01:00:00 00:01:02:00'), 'Expected range 01:00:00 to 01:02:00'));

        // 2. TEST XML GENERATION
        const xmlOutput = generateResolveXML('TestProject', 1, mockComments, 24);
        
        // Check 4: XML Structure
        newResults.push(assert('XML: Valid Tags', xmlOutput.includes('<xmeml version="5">') && xmlOutput.includes('</xmeml>')));
        
        // Check 5: Color Mapping
        newResults.push(assert('XML: Color Mapping (Resolved -> Green)', xmlOutput.includes('<name>Green</name>')));
        
        // 3. TEST CSV GENERATION
        const csvOutput = generateCSV(mockComments);
        newResults.push(assert('CSV: Contains Columns', csvOutput.includes('Timecode, Name, Description, Color')));

        // 4. TEST UTILS
        const id1 = generateId();
        const id2 = generateId();
        newResults.push(assert('Utils: Unique ID Generation', id1 !== id2 && id1.length > 10));

        setResults(newResults);
        setIsRunning(false);
    };

    useEffect(() => {
        runTests();
    }, []);

    const passedCount = results.filter(r => r.passed).length;
    const allPassed = passedCount === results.length && results.length > 0;

    return (
        <div className="min-h-screen bg-black text-zinc-100 p-8 font-mono">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <CheckCircle className="text-indigo-500" />
                            System Integrity Check
                        </h1>
                    </div>
                    <button onClick={runTests} disabled={isRunning} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                        {isRunning ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                        Rerun Tests
                    </button>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Test Suite: Export & Core Logic</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${allPassed ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                            {passedCount} / {results.length} PASSED
                        </span>
                    </div>
                    
                    <div className="divide-y divide-zinc-800">
                        {results.map((res, idx) => (
                            <div key={idx} className="px-6 py-4 flex items-start justify-between hover:bg-zinc-800/30 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        {res.passed ? (
                                            <CheckCircle size={16} className="text-green-500 shrink-0" />
                                        ) : (
                                            <XCircle size={16} className="text-red-500 shrink-0" />
                                        )}
                                        <span className={`font-bold text-sm ${res.passed ? 'text-zinc-200' : 'text-red-200'}`}>
                                            {res.name}
                                        </span>
                                    </div>
                                    {res.details && !res.passed && (
                                        <p className="text-xs text-red-400 mt-1 ml-6">{res.details}</p>
                                    )}
                                </div>
                                <span className="text-xs text-zinc-600 font-mono">
                                    {res.passed ? 'OK' : 'ERR'}
                                </span>
                            </div>
                        ))}
                        {results.length === 0 && (
                            <div className="p-8 text-center text-zinc-500 text-sm">Running tests...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
