#include "MRWHud.h"

#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "EngineUtils.h"
#include "MRWCicloGiorno.h"
#include "MRWMoto.h"

void AMRWHud::DrawHUD()
{
	Super::DrawHUD();
	const AMRWMoto* Moto = Cast<AMRWMoto>(GetOwningPawn());
	if (Moto == nullptr || Canvas == nullptr)
	{
		return;
	}
	UFont* Carattere = GEngine->GetLargeFont();
	const float Scala = Canvas->ClipY / 1080.0f;
	const FLinearColor Bianco(1.0f, 1.0f, 1.0f);
	const FLinearColor Giallo(1.0f, 0.85f, 0.2f);
	const FLinearColor Rosso(1.0f, 0.25f, 0.2f);

	// In basso a destra: tachimetro
	const float X = Canvas->ClipX - 380.0f * Scala;
	const float Y = Canvas->ClipY - 230.0f * Scala;
	DrawText(FString::Printf(TEXT("%3.0f km/h"), Moto->GetVelocitaKmh()), Bianco, X, Y, Carattere, 2.2f * Scala);
	DrawText(FString::Printf(TEXT("Marcia %d   %5.0f giri"), Moto->GetMarcia(), Moto->GetGiri()),
		Moto->GetGiri() > 8800.0f ? Rosso : Bianco, X, Y + 70.0f * Scala, Carattere, 1.2f * Scala);
	DrawText(FString::Printf(TEXT("Piega %2.0f   Impennata %2.0f"), FMath::Abs(Moto->GetPiega()), Moto->GetImpennata()),
		Bianco, X, Y + 110.0f * Scala, Carattere, 1.2f * Scala);
	DrawText(Moto->IsSuStrada() ? TEXT("Asfalto") : TEXT("Fuori strada"), Bianco, X, Y + 150.0f * Scala, Carattere, 1.2f * Scala);

	// In alto a sinistra: ora e meteo
	for (TActorIterator<AMRWCicloGiorno> It(GetWorld()); It; ++It)
	{
		const AMRWCicloGiorno* Meteo = *It;
		const int32 Ore = FMath::FloorToInt(Meteo->OraDelGiorno);
		const int32 Minuti = FMath::FloorToInt((Meteo->OraDelGiorno - Ore) * 60.0f);
		FString Testo = FString::Printf(TEXT("%02d:%02d"), Ore, Minuti);
		if (Meteo->Pioggia > 0.5f) Testo += TEXT("   pioggia");
		else if (Meteo->Bagnato > 0.1f) Testo += TEXT("   strada bagnata");
		DrawText(Testo, Bianco, 30.0f * Scala, 30.0f * Scala, Carattere, 1.2f * Scala);
		break;
	}

	// Messaggi (cadute, preset, dati mancanti)
	const FString Messaggio = Moto->GetMessaggio();
	if (!Messaggio.IsEmpty())
	{
		float Larghezza = 0.0f, Altezza = 0.0f;
		GetTextSize(Messaggio, Larghezza, Altezza, Carattere, 1.6f * Scala);
		DrawText(Messaggio, Moto->IsCaduta() ? Rosso : Giallo, (Canvas->ClipX - Larghezza) / 2.0f, Canvas->ClipY * 0.3f, Carattere, 1.6f * Scala);
	}

	// Comandi (in basso a sinistra)
	DrawText(TEXT("W gas  S freno ant.  Spazio freno post.  A/D piega  Shift peso dietro  I controllo impennata  C camera  R riparti  T ora  P pioggia  1-5 grafica"),
		FLinearColor(1.0f, 1.0f, 1.0f, 0.6f), 30.0f * Scala, Canvas->ClipY - 50.0f * Scala, GEngine->GetSmallFont(), 1.0f * Scala);
}
