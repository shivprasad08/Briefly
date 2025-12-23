'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { Input } from '@/components/Input';
import Hero from '@/components/ui/neural-network-hero';
import { Footer7 } from '@/components/ui/footer';
import { sessionsAPI } from '@/lib/api';

interface Session {
	id: number;
	name: string;
	created_at: string;
	current_summary: string | null;
}

export default function HomePage() {
	const [sessions, setSessions] = useState<Session[]>([]);
	const [loading, setLoading] = useState(true);
	const [newSessionName, setNewSessionName] = useState('');
	const [creatingSession, setCreatingSession] = useState(false);
	// Parallax-only; no infinite scroll state

	useEffect(() => {
		fetchSessions();
	}, []);

  // No IntersectionObserver; native scroll with parallax

	const fetchSessions = async () => {
		try {
			const response = await sessionsAPI.list();
			setSessions(response.data);
		} catch (error) {
			console.error('Failed to fetch sessions:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleCreateSession = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newSessionName.trim()) return;

		setCreatingSession(true);
		try {
			await sessionsAPI.create(newSessionName);
			setNewSessionName('');
			await fetchSessions();
		} catch (error) {
			console.error('Failed to create session:', error);
		} finally {
			setCreatingSession(false);
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	};

	return (
		<div className="min-h-screen bg-black text-white">
			<section className="relative" data-scroll-section>
				<Hero
					title="Briefly — Meeting insights, summaries, and answers without the busywork."
					description="Upload meeting notes and PDFs. Get instant insights, comprehensive summaries, and intelligent answers powered by AI."
					badgeText="Contextual AI"
					ctaButtons={[
						{ text: 'Create a session', href: '#sessions', primary: true },
						{ text: 'View sessions', href: '#sessions' },
					]}
					microDetails={[]}
				/>
			</section>

				<section id="sessions" className="bg-neutral-950 border-t border-neutral-800 pb-12" data-scroll-section>
				<div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 md:pt-16 pb-0">
					<div className="mb-6 sm:mb-10">
						<h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white mb-2">Your Sessions</h2>
						<p className="text-base sm:text-lg text-white/70">Spin up a new session or jump back into your work.</p>
					</div>

					<div className="mb-8 sm:mb-12">
						<Card className="bg-neutral-900/50 backdrop-blur-sm border-neutral-800 shadow-lg">
							<CardHeader>
								<CardTitle className="text-white text-lg sm:text-xl">Create New Session</CardTitle>
							</CardHeader>
							<CardContent>
								<form onSubmit={handleCreateSession} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
									<Input
										placeholder="Session name (e.g., Q4 Planning Meeting)"
										value={newSessionName}
										onChange={(e) => setNewSessionName(e.target.value)}
										disabled={creatingSession}
										className="flex-1 text-sm sm:text-base"
									/>
									<Button
										type="submit"
										disabled={creatingSession || !newSessionName.trim()}
										size="md"
										className="w-full sm:w-auto bg-[#6B2FD8] hover:bg-[#5A25B8] text-white border-purple-500/50 hover:shadow-[0_0_16px_rgba(107,47,216,0.45)] transition-all duration-300"
									>
										{creatingSession ? 'Creating...' : 'Create session'}
									</Button>
								</form>
							</CardContent>
						</Card>
					</div>

					{loading ? (
						<div className="text-center py-8">
							<p className="text-white/70">Loading sessions...</p>
						</div>
					) : sessions.length === 0 ? (
						<div className="text-center py-8">
							<p className="text-white/70">No sessions yet. Create one to get started.</p>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 sm:mb-10 md:mb-12">
							{sessions.map((session) => (
								<Link
									key={session.id}
									href={`/session/${session.id}`}
									className="group block rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 transition-all duration-300 hover:border-purple-500/50 hover:bg-neutral-900/60 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
								>
									<div className="flex flex-col h-full">
										<div className="flex items-start justify-between gap-2 mb-3">
											<h3 className="text-lg font-medium text-white line-clamp-1 group-hover:text-purple-400 transition-colors">
												{session.name}
											</h3>
										</div>
										<div className="text-xs text-white/50 mb-3">
											{formatDate(session.created_at)}
										</div>
										<p className="text-sm text-white/70 line-clamp-3 flex-1">
											{session.current_summary && session.current_summary.trim() 
												? session.current_summary 
												: 'No conversation yet. Start chatting to see a preview here.'}
										</p>
									</div>
								</Link>
							))}
						</div>
					)}
				</div>
			</section>
			<section data-scroll-section className="bg-black border-t border-neutral-800">
				<Footer7 />
			</section>
		</div>
	);
}